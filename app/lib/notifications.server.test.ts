import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { NotificationKind, UserRole } from "~/db/schema";
import {
  getNotificationFeed,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notify,
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
