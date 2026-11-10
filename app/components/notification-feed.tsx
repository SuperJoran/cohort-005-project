import { useEffect, useRef, useState } from "react";
import { Link, useFetcher, useRevalidator } from "react-router";
import { CheckCheck } from "lucide-react";
import { cn, formatRelativeTime } from "~/lib/utils";

// The sidebar's "For you" section: the unread count, the 3 newest unread
// Notifications, and "See all" to expand the full list in place. Following a
// Notification marks it read. There is no dismiss and no grouping.
// The badge is live (ADR 0013): while the tab is visible it holds one
// EventSource on the stream route, shows each pushed count at once and
// revalidates so the feed catches up. Quiet badge, no toast.

export interface FeedItem {
  id: number;
  text: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationFeedData {
  unreadCount: number;
  latestUnread: FeedItem[];
}

const NOTIFICATIONS_ROUTE = "/api/notifications";
const STREAM_ROUTE = "/api/notifications/stream";

/**
 * The unread count, kept live by the stream while the tab is visible. A hidden
 * tab closes its stream (browsers allow only 6 HTTP/1.1 connections per domain
 * across tabs) and reopens it when visible again; the server sends the current
 * count first on every connect, so nothing missed needs replaying.
 */
function useLiveUnreadCount(loadedCount: number) {
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const loadedCountRef = useRef(loadedCount);
  const { revalidate } = useRevalidator();
  const revalidateRef = useRef(revalidate);
  revalidateRef.current = revalidate;

  useEffect(() => {
    loadedCountRef.current = loadedCount;
    setLiveCount(null);
  }, [loadedCount]);

  useEffect(() => {
    let source: EventSource | null = null;

    function open() {
      if (source) return;
      source = new EventSource(STREAM_ROUTE);
      source.onmessage = (event) => {
        const count = Number(event.data);
        if (!Number.isFinite(count)) return;
        setLiveCount(count);
        if (count !== loadedCountRef.current) void revalidateRef.current();
      };
    }

    function close() {
      source?.close();
      source = null;
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") open();
      else close();
    }

    onVisibilityChange();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      close();
    };
  }, []);

  return liveCount ?? loadedCount;
}

function CountBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span
      aria-label={`${count} unread`}
      className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-5 tracking-normal text-primary-foreground"
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function NotificationFeed({ feed }: { feed: NotificationFeedData }) {
  const [showAll, setShowAll] = useState(false);
  const unreadCount = useLiveUnreadCount(feed.unreadCount);
  const allFetcher = useFetcher<{ notifications: FeedItem[] }>();
  const markFetcher = useFetcher();

  const items =
    showAll && allFetcher.data ? allFetcher.data.notifications : feed.latestUnread;

  function toggleShowAll() {
    if (!showAll) allFetcher.load(NOTIFICATIONS_ROUTE);
    setShowAll(!showAll);
  }

  function markRead(item: FeedItem) {
    if (item.read) return;
    markFetcher.submit(
      { intent: "mark-read", notificationId: item.id },
      { method: "post", action: NOTIFICATIONS_ROUTE }
    );
  }

  function markAllRead() {
    markFetcher.submit(
      { intent: "mark-all-read" },
      { method: "post", action: NOTIFICATIONS_ROUTE }
    );
  }

  return (
    <div className="border-t border-sidebar-border p-3">
      <div className="mb-2 flex items-center px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
        For you
        <CountBadge count={unreadCount} />
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            title="Mark all read"
            aria-label="Mark all read"
            className="ml-auto hover:text-sidebar-foreground"
          >
            <CheckCheck className="size-3.5" />
          </button>
        )}
      </div>

      {items.length === 0 && (
        <p className="px-3 text-xs text-sidebar-foreground/50">
          {showAll ? "No notifications yet." : "All caught up."}
        </p>
      )}

      <ul className={cn("space-y-0.5", showAll && "max-h-64 overflow-y-auto")}>
        {items.map((item) => (
          <li key={item.id}>
            <Link
              to={item.link}
              onClick={() => markRead(item)}
              className={cn(
                "block rounded-md px-3 py-1.5 text-xs leading-snug hover:bg-sidebar-accent",
                item.read
                  ? "text-sidebar-foreground/50"
                  : "text-sidebar-foreground"
              )}
            >
              <span className="line-clamp-2">{item.text}</span>
              <span
                className="text-[10px] text-sidebar-foreground/40"
                suppressHydrationWarning
              >
                {formatRelativeTime(item.createdAt)}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={toggleShowAll}
        className="mt-1 px-3 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground"
      >
        {showAll ? "Show less" : "See all"}
      </button>
    </div>
  );
}
