import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "~/db/schema";
import { NotificationKind, notifications } from "~/db/schema";
import type { Email } from "~/lib/mailer.server";

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

export type NotificationEvent = {
  kind: NotificationKind.SeatClaimed;
  claimerId: number;
  claimerName: string;
  courseTitle: string;
  teamAdminIds: number[];
};

/**
 * Writes the Notifications an event causes and returns its Emails. Never
 * notifies someone about their own action.
 */
export function notify(tx: Queryable, event: NotificationEvent): Email[] {
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
