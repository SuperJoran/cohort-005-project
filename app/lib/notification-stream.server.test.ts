import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { NotificationKind, UserRole } from "~/db/schema";
import { notify } from "./notifications.server";
import { unreadCountStream } from "./notification-stream.server";

type TestDb = ReturnType<typeof createTestDb>;

let db: TestDb;
let recipientId: number;
let claimerId: number;

beforeEach(() => {
  db = createTestDb();
  recipientId = seedBaseData(db).user.id;
  claimerId = db
    .insert(schema.users)
    .values({ name: "Claimer", email: "claimer@example.com", role: UserRole.Student })
    .returning()
    .get().id;
});

function seatClaimedBy(claimerName: string) {
  notify(db, {
    kind: NotificationKind.SeatClaimed,
    claimerId,
    claimerName,
    courseTitle: "Test Course",
    teamAdminIds: [recipientId],
  });
}

function reader(response: Response) {
  const stream = response.body!.getReader();
  const decoder = new TextDecoder();
  return async () => {
    const { value, done } = await stream.read();
    return done ? null : decoder.decode(value);
  };
}

describe("the unread count stream", () => {
  it("is an unbuffered event stream", () => {
    const tab = new AbortController();
    const response = unreadCountStream(db, recipientId, tab.signal);
    tab.abort();

    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
    expect(response.headers.get("X-Accel-Buffering")).toBe("no");
  });

  it("sends the current unread count first, then each new count", async () => {
    seatClaimedBy("Ann");
    const next = reader(
      unreadCountStream(db, recipientId, new AbortController().signal)
    );

    expect(await next()).toBe("data: 1\n\n");

    seatClaimedBy("Ben");
    expect(await next()).toBe("data: 2\n\n");
  });

  it("ends when the tab goes away", async () => {
    const tab = new AbortController();
    const next = reader(unreadCountStream(db, recipientId, tab.signal));
    await next();

    tab.abort();
    seatClaimedBy("Ann");

    expect(await next()).toBeNull();
  });
});
