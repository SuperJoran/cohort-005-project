import { and, eq } from "drizzle-orm";
import {
  coupons,
  courses,
  enrollments,
  purchases,
  teamMembers,
  users,
  NotificationKind,
  TeamMemberRole,
} from "~/db/schema";
import { getSeatAvailability } from "~/lib/refunds.server";
import { notify, type Db } from "~/lib/notifications.server";

// ─── Seats ───
// A Student claiming a Seat on a Team Licence. See GLOSSARY.md.
//
// Every function takes the database first, so tests can hand in an in-memory
// one. Uses positional parameters (project convention).

export const SEAT_ON_HOLD =
  "This seat can't be claimed right now. Ask the person who shared it with you.";
export const SEAT_REFUNDED =
  "This seat is no longer available. Ask the person who shared it with you.";

export type ClaimSeatResult =
  | { ok: true; enrollment: typeof enrollments.$inferSelect }
  | { ok: false; error: string };

/**
 * Claims the Seat with this code for the Student, giving them an Enrollment,
 * and notifies the team's Team Admins. All in one transaction.
 */
export function claimSeat(
  db: Db,
  code: string,
  userId: number,
  userCountry: string
): ClaimSeatResult {
  return db.transaction((tx): ClaimSeatResult => {
    const seat = tx.select().from(coupons).where(eq(coupons.code, code)).get();
    if (!seat) {
      return { ok: false, error: "Coupon not found" };
    }

    if (seat.redeemedByUserId !== null) {
      return { ok: false, error: "Coupon has already been redeemed" };
    }

    const availability = getSeatAvailability(tx, seat);
    if (availability === "on_hold") {
      return { ok: false, error: SEAT_ON_HOLD };
    }
    if (availability === "refunded") {
      return { ok: false, error: SEAT_REFUNDED };
    }

    const existingEnrollment = tx
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.userId, userId),
          eq(enrollments.courseId, seat.courseId)
        )
      )
      .get();
    if (existingEnrollment) {
      return { ok: false, error: "You are already enrolled in this course" };
    }

    const licence = tx
      .select()
      .from(purchases)
      .where(eq(purchases.id, seat.purchaseId))
      .get();
    if (licence?.country && licence.country !== userCountry) {
      return {
        ok: false,
        error:
          "This coupon can only be redeemed from the same country as the purchaser",
      };
    }

    tx.update(coupons)
      .set({ redeemedByUserId: userId, redeemedAt: new Date().toISOString() })
      .where(eq(coupons.id, seat.id))
      .run();

    const enrollment = tx
      .insert(enrollments)
      .values({ userId, courseId: seat.courseId })
      .returning()
      .get();

    const claimer = tx.select().from(users).where(eq(users.id, userId)).get()!;
    const course = tx
      .select()
      .from(courses)
      .where(eq(courses.id, seat.courseId))
      .get()!;
    const teamAdminIds = tx
      .select({ userId: teamMembers.userId })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, seat.teamId),
          eq(teamMembers.role, TeamMemberRole.Admin)
        )
      )
      .all()
      .map((member) => member.userId);

    notify(tx, {
      kind: NotificationKind.SeatClaimed,
      claimerId: userId,
      claimerName: claimer.name,
      courseTitle: course.title,
      teamAdminIds,
    });

    return { ok: true, enrollment };
  });
}
