import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "~/db/schema";
import { NotificationKind, RefundStatus, notifications } from "~/db/schema";
import type { Email } from "~/lib/mailer.server";
import { formatPrice } from "~/lib/utils";

// ─── Notifications ───
// A Notification is a message Cadence keeps for one Recipient inside the app.
// Every event goes through one `notify` step, called inside the event's
// transaction: it writes the Notification rows atomically with the state change
// and returns the Emails the caller sends once the transaction is saved.
// See GLOSSARY.md and the "Wayfinder: In-app notifications" map.
//
// Every function takes the database first, so tests can hand in an in-memory
// one. Uses positional parameters (project convention).

export type Db = BetterSQLite3Database<typeof schema>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Queryable = Db | Tx;

type SeatClaimed = {
  kind: NotificationKind.SeatClaimed;
  claimerId: number;
  claimerName: string;
  courseTitle: string;
  teamAdminIds: number[];
};

/** A Platform Admin approved or declined a Refund Request. */
type RefundRequestDecided = {
  kind: NotificationKind.RefundRequestDecided;
  decision: RefundStatus.Approved | RefundStatus.Declined;
  platformAdminId: number;
  // The buyer: the Student of an Individual Purchase or the Team Admin of a
  // Team Licence.
  buyer: { id: number; name: string; email: string };
  course: { title: string; slug: string };
  amountPaid: number;
  note: string | null;
};

/** A buyer raised a new Open Refund Request. */
type RefundRequested = {
  kind: NotificationKind.RefundRequested;
  buyerId: number;
  buyerName: string;
  courseTitle: string;
  platformAdminIds: number[];
};

/**
 * A reply to a top-level comment. Only that comment's author hears of it;
 * earlier repliers get nothing.
 */
type CommentReplied = {
  kind: NotificationKind.CommentReplied;
  replierId: number;
  replierName: string;
  commentAuthorId: number;
  lessonTitle: string;
  threadLink: string;
};

/** A new top-level comment, which reaches the course's Instructor. */
type QuestionPosted = {
  kind: NotificationKind.QuestionPosted;
  authorId: number;
  instructorId: number;
  lessonTitle: string;
  courseTitle: string;
};

export type NotificationEvent =
  | SeatClaimed
  | RefundRequestDecided
  | RefundRequested
  | CommentReplied
  | QuestionPosted;

/**
 * Writes the Notifications an event causes and returns its Emails. Never
 * notifies someone about their own action.
 */
export function notify(tx: Queryable, event: NotificationEvent): Email[] {
  switch (event.kind) {
    case NotificationKind.SeatClaimed:
      return notifySeatClaimed(tx, event);
    case NotificationKind.RefundRequestDecided:
      return notifyRefundRequestDecided(tx, event);
    case NotificationKind.RefundRequested:
      return notifyRefundRequested(tx, event);
    case NotificationKind.CommentReplied:
      return notifyCommentReplied(tx, event);
    case NotificationKind.QuestionPosted:
      return notifyQuestionPosted(tx, event);
  }
}

// Comment snapshots never quote the comment body.
function notifyCommentReplied(tx: Queryable, event: CommentReplied): Email[] {
  if (event.commentAuthorId !== event.replierId) {
    tx.insert(notifications)
      .values({
        recipientId: event.commentAuthorId,
        kind: event.kind,
        text: `${event.replierName} replied to your comment on ${event.lessonTitle}`,
        link: event.threadLink,
      })
      .run();
  }
  // Its Re-engagement Email arrives with the pending_emails sweeper.
  return [];
}

function notifyQuestionPosted(tx: Queryable, event: QuestionPosted): Email[] {
  if (event.instructorId !== event.authorId) {
    tx.insert(notifications)
      .values({
        recipientId: event.instructorId,
        kind: event.kind,
        text: `New question on ${event.lessonTitle} in ${event.courseTitle}`,
        link: "/instructor/questions",
      })
      .run();
  }
  // Its Re-engagement Email arrives with the pending_emails sweeper.
  return [];
}

function notifySeatClaimed(tx: Queryable, event: SeatClaimed): Email[] {
  const recipientIds = event.teamAdminIds.filter(
    (id) => id !== event.claimerId
  );
  if (recipientIds.length > 0) {
    tx.insert(notifications)
      .values(
        recipientIds.map((recipientId) => ({
          recipientId,
          kind: event.kind,
          text: `${event.claimerName} claimed a Seat on ${event.courseTitle}`,
          link: "/team",
        }))
      )
      .run();
  }
  // Seat claimed is Notification only: it is just information.
  return [];
}

function notifyRefundRequestDecided(
  tx: Queryable,
  event: RefundRequestDecided
): Email[] {
  if (event.buyer.id !== event.platformAdminId) {
    tx.insert(notifications)
      .values({
        recipientId: event.buyer.id,
        kind: event.kind,
        text: `Your Refund Request for ${event.course.title} was ${event.decision}`,
        link: `/courses/${event.course.slug}`,
      })
      .run();
  }
  // A Transactional Email: it always goes, sent as soon as the decision is saved.
  return [buildDecisionEmail(event)];
}

/** The Email the buyer gets once their Refund Request is decided. */
function buildDecisionEmail(event: RefundRequestDecided): Email {
  const { buyer, course, decision, note } = event;
  const noteLines = note ? ["", note] : [];

  const middle =
    decision === RefundStatus.Approved
      ? [
          `We have approved your refund request for "${course.title}".`,
          `${formatPrice(event.amountPaid)}, the full amount you paid, is on its way back to you.`,
          ...noteLines,
        ]
      : [
          `We have looked at your refund request for "${course.title}" and decided not to refund it.`,
          ...noteLines,
          "",
          "You still have everything you bought. If something changes, you can raise a new refund request.",
        ];

  return {
    to: buyer.email,
    subject: `Refund ${decision} — ${course.title}`,
    body: [`Hi ${buyer.name},`, "", ...middle, "", "— The Cadence team"].join(
      "\n"
    ),
  };
}

export type FeedItem = {
  id: number;
  text: string;
  link: string;
  read: boolean;
  createdAt: string;
};

const FEED_SIZE = 3;

function selectFeedItems(db: Queryable) {
  return db
    .select({
      id: notifications.id,
      text: notifications.text,
      link: notifications.link,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications);
}

function toFeedItem(row: {
  id: number;
  text: string;
  link: string;
  readAt: string | null;
  createdAt: string;
}): FeedItem {
  return {
    id: row.id,
    text: row.text,
    link: row.link,
    read: row.readAt !== null,
    createdAt: row.createdAt,
  };
}

function isUnreadFor(recipientId: number) {
  return and(
    eq(notifications.recipientId, recipientId),
    isNull(notifications.readAt)
  );
}

/** What the sidebar's "For you" section shows: the unread count and the newest unread. */
export function getNotificationFeed(db: Queryable, recipientId: number) {
  const unreadCount =
    db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(isUnreadFor(recipientId))
      .get()?.count ?? 0;

  const latestUnread = selectFeedItems(db)
    .where(isUnreadFor(recipientId))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(FEED_SIZE)
    .all()
    .map(toFeedItem);

  return { unreadCount, latestUnread };
}

/** Every Notification the Recipient has, read and unread, newest first. */
export function listNotifications(
  db: Queryable,
  recipientId: number
): FeedItem[] {
  return selectFeedItems(db)
    .where(eq(notifications.recipientId, recipientId))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .all()
    .map(toFeedItem);
}

/** Marks one of the Recipient's own Notifications read. Anyone else's is left alone. */
export function markNotificationRead(
  db: Queryable,
  recipientId: number,
  notificationId: number
) {
  db.update(notifications)
    .set({ readAt: new Date().toISOString() })
    .where(
      and(isUnreadFor(recipientId), eq(notifications.id, notificationId))
    )
    .run();
}

/** Marks every unread Notification of the Recipient read. */
export function markAllNotificationsRead(db: Queryable, recipientId: number) {
  db.update(notifications)
    .set({ readAt: new Date().toISOString() })
    .where(isUnreadFor(recipientId))
    .run();
}

function notifyRefundRequested(tx: Queryable, event: RefundRequested): Email[] {
  const recipientIds = event.platformAdminIds.filter(
    (id) => id !== event.buyerId
  );
  if (recipientIds.length > 0) {
    tx.insert(notifications)
      .values(
        recipientIds.map((recipientId) => ({
          recipientId,
          kind: event.kind,
          text: `${event.buyerName} requested a Refund for ${event.courseTitle}`,
          link: "/admin/refunds",
        }))
      )
      .run();
  }
  // The Platform Admins' Re-engagement Email arrives with the pending_emails
  // sweeper, not here.
  return [];
}
