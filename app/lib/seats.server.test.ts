import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { TeamMemberRole, UserRole } from "~/db/schema";
import { claimSeat } from "./seats.server";
import { getNotificationFeed } from "./notifications.server";

type TestDb = ReturnType<typeof createTestDb>;

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let teamAdmin: typeof schema.users.$inferSelect;
let team: typeof schema.teams.$inferSelect;
let seatCodes: string[];

function addStudent(name: string) {
  return db
    .insert(schema.users)
    .values({
      name,
      email: `${name.toLowerCase().replace(/ /g, ".")}@example.com`,
      role: UserRole.Student,
    })
    .returning()
    .get();
}

function addTeamAdmin(name: string) {
  const user = addStudent(name);
  db.insert(schema.teamMembers)
    .values({ teamId: team.id, userId: user.id, role: TeamMemberRole.Admin })
    .run();
  return user;
}

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
  team = db.insert(schema.teams).values({}).returning().get();
  teamAdmin = addTeamAdmin("Bossy McBossface");

  const licence = db
    .insert(schema.purchases)
    .values({
      userId: teamAdmin.id,
      courseId: base.course.id,
      amountPaid: 3 * 7900,
      country: "BE",
    })
    .returning()
    .get();

  seatCodes = ["SEAT-1", "SEAT-2", "SEAT-3"];
  db.insert(schema.coupons)
    .values(
      seatCodes.map((code) => ({
        teamId: team.id,
        courseId: base.course.id,
        code,
        purchaseId: licence.id,
      }))
    )
    .run();
});

describe("claiming a Seat", () => {
  it("notifies the Team Admin who the Seat went to", () => {
    const olivia = addStudent("Olivia Martinez");

    const result = claimSeat(db, seatCodes[0], olivia.id, "BE");

    expect(result.ok).toBe(true);
    const feed = getNotificationFeed(db, teamAdmin.id);
    expect(feed.unreadCount).toBe(1);
    expect(feed.latestUnread).toEqual([
      expect.objectContaining({
        text: "Olivia Martinez claimed a Seat on Test Course",
        link: "/team",
        read: false,
      }),
    ]);
  });

  it("notifies every Team Admin of the team, one Notification each", () => {
    const coAdmin = addTeamAdmin("Cora Admin");
    const olivia = addStudent("Olivia Martinez");

    claimSeat(db, seatCodes[0], olivia.id, "BE");

    expect(getNotificationFeed(db, teamAdmin.id).unreadCount).toBe(1);
    expect(getNotificationFeed(db, coAdmin.id).unreadCount).toBe(1);
    expect(getNotificationFeed(db, olivia.id).unreadCount).toBe(0);
  });

  it("does not notify a Team Admin who claims a Seat themselves", () => {
    const coAdmin = addTeamAdmin("Cora Admin");

    const result = claimSeat(db, seatCodes[0], coAdmin.id, "BE");

    expect(result.ok).toBe(true);
    expect(getNotificationFeed(db, coAdmin.id).unreadCount).toBe(0);
    expect(getNotificationFeed(db, teamAdmin.id).unreadCount).toBe(1);
  });

  it("notifies no one when the claim is refused", () => {
    const olivia = addStudent("Olivia Martinez");
    const liam = addStudent("Liam Smith");
    claimSeat(db, seatCodes[0], olivia.id, "BE");

    const taken = claimSeat(db, seatCodes[0], liam.id, "BE");
    const wrongCountry = claimSeat(db, seatCodes[1], liam.id, "US");

    expect(taken.ok).toBe(false);
    expect(wrongCountry.ok).toBe(false);
    expect(getNotificationFeed(db, teamAdmin.id).unreadCount).toBe(1);
  });
});
