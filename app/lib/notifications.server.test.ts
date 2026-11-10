import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { NotificationKind, UserRole } from "~/db/schema";
import {
  getNotificationFeed,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notify,
  subscribeToUnreadCount,
} from "./notifications.server";

type TestDb = ReturnType<typeof createTestDb>;

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let recipientId: number;
let claimerId: number;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
  recipientId = base.user.id;
  claimerId = db
    .insert(schema.users)
    .values({ name: "Claimer", email: "claimer@example.com", role: UserRole.Student })
    .returning()
    .get().id;
});

function seatClaimedBy(claimerName: string, to = recipientId) {
  notify(db, {
    kind: NotificationKind.SeatClaimed,
    claimerId,
    claimerName,
    courseTitle: "Test Course",
    teamAdminIds: [to],
  });
}

function texts(items: { text: string }[]) {
  return items.map((item) => item.text);
}

describe("the notification feed", () => {
  it("shows the 3 newest unread Notifications, newest first, and counts them all", () => {
    for (const name of ["Ann", "Ben", "Cat", "Dan"]) seatClaimedBy(name);

    const feed = getNotificationFeed(db, recipientId);

    expect(feed.unreadCount).toBe(4);
    expect(texts(feed.latestUnread)).toEqual([
      "Dan claimed a Seat on Test Course",
      "Cat claimed a Seat on Test Course",
      "Ben claimed a Seat on Test Course",
    ]);
  });

  it("lists every Notification, read and unread, newest first", () => {
    seatClaimedBy("Ann");
    seatClaimedBy("Ben");
    const [ben] = getNotificationFeed(db, recipientId).latestUnread;
    markNotificationRead(db, recipientId, ben.id);

    const all = listNotifications(db, recipientId);

    expect(all.map(({ text, read }) => ({ text, read }))).toEqual([
      { text: "Ben claimed a Seat on Test Course", read: true },
      { text: "Ann claimed a Seat on Test Course", read: false },
    ]);
  });
});

describe("marking Notifications read", () => {
  it("takes a read Notification out of the unread feed", () => {
    seatClaimedBy("Ann");
    seatClaimedBy("Ben");
    const [ben] = getNotificationFeed(db, recipientId).latestUnread;

    markNotificationRead(db, recipientId, ben.id);

    const feed = getNotificationFeed(db, recipientId);
    expect(feed.unreadCount).toBe(1);
    expect(texts(feed.latestUnread)).toEqual([
      "Ann claimed a Seat on Test Course",
    ]);
  });

  it("never marks someone else's Notification read", () => {
    const otherId = base.instructor.id;
    seatClaimedBy("Ann", otherId);
    const [theirs] = getNotificationFeed(db, otherId).latestUnread;

    markNotificationRead(db, recipientId, theirs.id);
    markAllNotificationsRead(db, recipientId);

    expect(getNotificationFeed(db, otherId).unreadCount).toBe(1);
  });

  it("marks all of the Recipient's Notifications read at once", () => {
    for (const name of ["Ann", "Ben", "Cat", "Dan"]) seatClaimedBy(name);

    markAllNotificationsRead(db, recipientId);

    const feed = getNotificationFeed(db, recipientId);
    expect(feed.unreadCount).toBe(0);
    expect(feed.latestUnread).toEqual([]);
    expect(listNotifications(db, recipientId)).toHaveLength(4);
  });
});

/** Lets queued pushes run: they go out once the current synchronous work (the transaction) is done. */
function afterCommit() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

const unsubscribes: (() => void)[] = [];
afterEach(() => {
  unsubscribes.splice(0).forEach((unsubscribe) => unsubscribe());
});

function listenToUnreadCount(id = recipientId) {
  const pushed: number[] = [];
  const unsubscribe = subscribeToUnreadCount(id, (count) => pushed.push(count));
  unsubscribes.push(unsubscribe);
  return { pushed, unsubscribe };
}

describe("live unread count", () => {
  it("pushes the Recipient's new unread count once the notifying transaction commits", async () => {
    seatClaimedBy("Ann");
    await afterCommit();
    const { pushed } = listenToUnreadCount();

    db.transaction((tx) => {
      notify(tx, {
        kind: NotificationKind.SeatClaimed,
        claimerId,
        claimerName: "Ben",
        courseTitle: "Test Course",
        teamAdminIds: [recipientId],
      });
      expect(pushed).toEqual([]);
    });
    await afterCommit();

    expect(pushed).toEqual([2]);
  });

  it("pushes the committed count, not the notified one, when the transaction rolls back", async () => {
    const { pushed } = listenToUnreadCount();

    expect(() =>
      db.transaction((tx) => {
        notify(tx, {
          kind: NotificationKind.SeatClaimed,
          claimerId,
          claimerName: "Ben",
          courseTitle: "Test Course",
          teamAdminIds: [recipientId],
        });
        throw new Error("something later in the event failed");
      })
    ).toThrow();
    await afterCommit();

    expect(pushed.every((count) => count === 0)).toBe(true);
  });

  it("pushes the lower count when the Recipient reads one or all, so other tabs update", async () => {
    for (const name of ["Ann", "Ben", "Cat"]) seatClaimedBy(name);
    await afterCommit();
    const { pushed } = listenToUnreadCount();
    const [cat] = getNotificationFeed(db, recipientId).latestUnread;

    markNotificationRead(db, recipientId, cat.id);
    await afterCommit();
    markAllNotificationsRead(db, recipientId);
    await afterCommit();

    expect(pushed).toEqual([2, 0]);
  });

  it("only pushes to the Recipients the event concerns, and stops after unsubscribing", async () => {
    const mine = listenToUnreadCount();
    const theirs = listenToUnreadCount(base.instructor.id);

    seatClaimedBy("Ann");
    await afterCommit();
    mine.unsubscribe();
    seatClaimedBy("Ben");
    await afterCommit();

    expect(mine.pushed).toEqual([1]);
    expect(theirs.pushed).toEqual([]);
  });
});
