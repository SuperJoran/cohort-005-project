// PROTOTYPE — throwaway. Answers "What does the notification list look like?"
// Four variants of the notification entry point + list, mounted in the real
// app layout (layout.app.tsx), switchable via ?variant=A|B|C|D.
// State is in memory: mark read / dismiss reset on reload. Links are real routes.
//
//   A  Bell popover      bell beside "Cadence", dropdown list, flat, newest first
//   B  Drawer            "Notifications" nav item, right slide-over, grouped by day, dismiss (x)
//   C  Inbox             "Inbox" nav item, full-height inbox over the page, grouped by kind,
//                        Unread / All tabs, archive, bulk mark read
//   D  Sidebar feed      no separate list: latest unread inline in the sidebar, read on click,
//                        "see all" expands; no dismiss
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  Bell,
  BellDot,
  Check,
  CheckCheck,
  Inbox,
  MessageSquare,
  Receipt,
  UsersRound,
  X,
  Archive,
  CornerDownRight,
} from "lucide-react";
import { cn } from "~/lib/utils";
import {
  type ProtoNotification,
  type NotificationKind,
  timeAgo,
  dayBucket,
  kindLabel,
} from "./mock-data";

export const NOTIFICATION_VARIANTS = [
  { key: "A", name: "Bell popover" },
  { key: "B", name: "Drawer, by day, dismiss" },
  { key: "C", name: "Inbox page, by kind" },
  { key: "D", name: "Inline sidebar feed" },
];

const kindIcon: Record<NotificationKind, React.ReactNode> = {
  "refund-decided": <Receipt className="size-4" />,
  "new-refund-request": <Receipt className="size-4" />,
  reply: <CornerDownRight className="size-4" />,
  "new-comment": <MessageSquare className="size-4" />,
  "seat-claimed": <UsersRound className="size-4" />,
};

function useProtoState(initial: ProtoNotification[]) {
  const [items, setItems] = useState(initial);
  // reset when the DevUI user switches (initial list identity changes)
  const [seed, setSeed] = useState(initial);
  if (seed !== initial) {
    setSeed(initial);
    setItems(initial);
  }
  return {
    items,
    unread: items.filter((n) => !n.read).length,
    markRead: (id: number) =>
      setItems((xs) => xs.map((n) => (n.id === id ? { ...n, read: true } : n))),
    toggleRead: (id: number) =>
      setItems((xs) => xs.map((n) => (n.id === id ? { ...n, read: !n.read } : n))),
    markAllRead: () => setItems((xs) => xs.map((n) => ({ ...n, read: true }))),
    dismiss: (id: number) => setItems((xs) => xs.filter((n) => n.id !== id)),
  };
}

function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count === 0) return null;
  return (
    <span
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-5 text-primary-foreground",
        className
      )}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

function StateReadout({ items }: { items: ProtoNotification[] }) {
  return (
    <div className="fixed left-60 bottom-4 z-[99] rounded-md bg-black/80 px-3 py-1.5 font-mono text-xs text-white">
      prototype state: {items.length} kept · {items.filter((n) => !n.read).length} unread ·{" "}
      {items.filter((n) => n.read).length} read
    </div>
  );
}

type Slots = {
  headerSlot?: React.ReactNode;
  navSlot?: React.ReactNode;
  sidebarSection?: React.ReactNode;
  overlay?: React.ReactNode;
};

export function useNotificationsPrototype(
  variant: string,
  initial: ProtoNotification[]
): Slots {
  const s = useProtoState(initial);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  function follow(n: ProtoNotification) {
    s.markRead(n.id);
    setOpen(false);
    navigate(n.href + window.location.search);
  }

  const readout = <StateReadout items={s.items} />;

  if (variant === "B") return variantB(s, open, setOpen, follow, readout);
  if (variant === "C") return variantC(s, open, setOpen, follow, readout);
  if (variant === "D") return variantD(s, follow, readout);
  return variantA(s, open, setOpen, follow, readout);
}

type S = ReturnType<typeof useProtoState>;

// ─── A: bell popover ──────────────────────────────────────────────────────
function variantA(
  s: S,
  open: boolean,
  setOpen: (b: boolean) => void,
  follow: (n: ProtoNotification) => void,
  readout: React.ReactNode
): Slots {
  return {
    headerSlot: (
      <div className="relative ml-auto">
        <button
          onClick={() => setOpen(!open)}
          className="relative rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent"
          title="Notifications"
        >
          {s.unread > 0 ? <BellDot className="size-5" /> : <Bell className="size-5" />}
          <CountBadge count={s.unread} className="absolute -right-1.5 -top-1" />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-10 z-50 w-96 rounded-lg border bg-popover text-popover-foreground shadow-xl">
              <div className="flex items-center justify-between border-b px-4 py-2.5">
                <span className="text-sm font-semibold">Notifications</span>
                <button
                  onClick={s.markAllRead}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Mark all as read
                </button>
              </div>
              <ul className="max-h-[28rem] overflow-y-auto">
                {s.items.length === 0 && (
                  <li className="p-6 text-center text-sm text-muted-foreground">
                    You're all caught up.
                  </li>
                )}
                {s.items.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => follow(n)}
                      className={cn(
                        "flex w-full gap-3 px-4 py-3 text-left text-sm hover:bg-accent",
                        !n.read && "bg-primary/5"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          n.read ? "bg-transparent" : "bg-primary"
                        )}
                      />
                      <span className={cn("flex-1", n.read && "text-muted-foreground")}>
                        {n.text}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {timeAgo(n.minutesAgo)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
        {readout}
      </div>
    ),
  };
}

// ─── B: drawer, grouped by day, dismiss ───────────────────────────────────
function variantB(
  s: S,
  open: boolean,
  setOpen: (b: boolean) => void,
  follow: (n: ProtoNotification) => void,
  readout: React.ReactNode
): Slots {
  const groups = (["Today", "This week", "Earlier"] as const)
    .map((label) => ({
      label,
      items: s.items.filter((n) => dayBucket(n.minutesAgo) === label),
    }))
    .filter((g) => g.items.length > 0);

  return {
    navSlot: (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <Bell className="size-4" />
        Notifications
        <CountBadge count={s.unread} className="ml-auto" />
      </button>
    ),
    overlay: (
      <>
        {open && (
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setOpen(false)} />
        )}
        <aside
          className={cn(
            "fixed right-0 top-0 z-50 flex h-screen w-[26rem] flex-col border-l bg-background shadow-2xl transition-transform",
            open ? "translate-x-0" : "translate-x-full"
          )}
        >
          <div className="flex h-14 items-center gap-2 border-b px-4">
            <span className="font-semibold">Notifications</span>
            <CountBadge count={s.unread} />
            <button
              onClick={s.markAllRead}
              className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="size-3.5" /> Mark all read
            </button>
            <button onClick={() => setOpen(false)} className="rounded p-1 hover:bg-accent">
              <X className="size-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {groups.length === 0 && (
              <p className="p-8 text-center text-sm text-muted-foreground">Nothing here.</p>
            )}
            {groups.map((g) => (
              <section key={g.label}>
                <h3 className="sticky top-0 bg-muted/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
                  {g.label}
                </h3>
                <ul>
                  {g.items.map((n) => (
                    <li
                      key={n.id}
                      className={cn(
                        "group flex items-start gap-3 border-b px-4 py-3",
                        !n.read && "border-l-4 border-l-primary pl-3"
                      )}
                    >
                      <span className="mt-0.5 rounded-full bg-muted p-1.5 text-muted-foreground">
                        {kindIcon[n.kind]}
                      </span>
                      <button
                        onClick={() => follow(n)}
                        className={cn(
                          "flex-1 text-left text-sm hover:underline",
                          !n.read ? "font-medium" : "text-muted-foreground"
                        )}
                      >
                        {n.text}
                        <div className="mt-0.5 text-xs font-normal text-muted-foreground">
                          {timeAgo(n.minutesAgo)} ago
                        </div>
                      </button>
                      <button
                        onClick={() => s.dismiss(n.id)}
                        title="Dismiss"
                        className="rounded p-1 text-muted-foreground opacity-0 hover:bg-accent group-hover:opacity-100"
                      >
                        <X className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </aside>
        {readout}
      </>
    ),
  };
}

// ─── C: inbox, grouped by kind, Unread/All, archive ───────────────────────
function variantC(
  s: S,
  open: boolean,
  setOpen: (b: boolean) => void,
  follow: (n: ProtoNotification) => void,
  readout: React.ReactNode
): Slots {
  return {
    navSlot: (
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          open
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        <Inbox className="size-4" />
        Inbox
        <CountBadge count={s.unread} className="ml-auto" />
      </button>
    ),
    overlay: (
      <>
        {open && <InboxPage s={s} follow={follow} onClose={() => setOpen(false)} />}
        {readout}
      </>
    ),
  };
}

function InboxPage({
  s,
  follow,
  onClose,
}: {
  s: S;
  follow: (n: ProtoNotification) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"unread" | "all">("unread");
  const visible = s.items.filter((n) => tab === "all" || !n.read);
  const byKind = useMemo(() => {
    const m = new Map<NotificationKind, ProtoNotification[]>();
    for (const n of visible) m.set(n.kind, [...(m.get(n.kind) ?? []), n]);
    return [...m.entries()];
  }, [visible]);

  return (
    <div className="fixed inset-y-0 left-56 right-0 z-30 overflow-y-auto bg-background">
      <div className="mx-auto max-w-3xl p-8">
        <div className="mb-6 flex items-center gap-3">
          <h1 className="text-2xl font-bold">Inbox</h1>
          <div className="ml-4 flex rounded-md border p-0.5 text-sm">
            {(["unread", "all"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "rounded px-3 py-1 capitalize",
                  tab === t && "bg-accent font-medium"
                )}
              >
                {t}
                {t === "unread" && ` (${s.unread})`}
              </button>
            ))}
          </div>
          <button
            onClick={s.markAllRead}
            className="ml-auto flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            <CheckCheck className="size-4" /> Mark all read
          </button>
          <button onClick={onClose} className="rounded p-1.5 hover:bg-accent" title="Close">
            <X className="size-4" />
          </button>
        </div>

        {byKind.length === 0 && (
          <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
            Inbox zero. Nothing needs you right now.
          </div>
        )}

        <div className="space-y-6">
          {byKind.map(([kind, items]) => (
            <section key={kind} className="rounded-lg border">
              <header className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2 text-sm font-semibold">
                {kindIcon[kind]} {kindLabel[kind]}
                <span className="text-muted-foreground">· {items.length}</span>
              </header>
              <ul className="divide-y">
                {items.map((n) => (
                  <li key={n.id} className="flex items-center gap-3 px-4 py-2.5">
                    <button
                      onClick={() => s.toggleRead(n.id)}
                      title={n.read ? "Mark unread" : "Mark read"}
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded border",
                        n.read && "bg-muted text-muted-foreground"
                      )}
                    >
                      {n.read && <Check className="size-3" />}
                    </button>
                    <button
                      onClick={() => follow(n)}
                      className={cn(
                        "flex-1 truncate text-left text-sm hover:underline",
                        !n.read ? "font-semibold" : "text-muted-foreground"
                      )}
                    >
                      {n.text}
                    </button>
                    <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">
                      {timeAgo(n.minutesAgo)}
                    </span>
                    <button
                      onClick={() => s.dismiss(n.id)}
                      title="Archive"
                      className="rounded p-1 text-muted-foreground hover:bg-accent"
                    >
                      <Archive className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── D: inline sidebar feed ───────────────────────────────────────────────
function variantD(
  s: S,
  follow: (n: ProtoNotification) => void,
  readout: React.ReactNode
): Slots {
  return {
    sidebarSection: <SidebarFeed s={s} follow={follow} />,
    overlay: readout,
  };
}

function SidebarFeed({ s, follow }: { s: S; follow: (n: ProtoNotification) => void }) {
  const [all, setAll] = useState(false);
  const unread = s.items.filter((n) => !n.read);
  const shown = all ? s.items : unread.slice(0, 3);
  return (
    <div className="border-t border-sidebar-border p-3">
      <div className="mb-2 flex items-center px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
        For you
        <CountBadge count={s.unread} className="ml-2" />
        {s.unread > 0 && (
          <button
            onClick={s.markAllRead}
            title="Mark all read"
            className="ml-auto normal-case tracking-normal hover:text-sidebar-foreground"
          >
            <CheckCheck className="size-3.5" />
          </button>
        )}
      </div>
      {shown.length === 0 && (
        <p className="px-3 text-xs text-sidebar-foreground/50">All caught up.</p>
      )}
      <ul className={cn("space-y-0.5", all && "max-h-64 overflow-y-auto")}>
        {shown.map((n) => (
          <li key={n.id}>
            <Link
              to={n.href}
              onClick={(e) => {
                e.preventDefault();
                follow(n);
              }}
              className={cn(
                "block rounded-md px-3 py-1.5 text-xs leading-snug hover:bg-sidebar-accent",
                n.read ? "text-sidebar-foreground/50" : "text-sidebar-foreground"
              )}
            >
              <span className="line-clamp-2">{n.text}</span>
              <span className="text-[10px] text-sidebar-foreground/40">
                {timeAgo(n.minutesAgo)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {(unread.length > 3 || all || s.items.length > unread.length) && (
        <button
          onClick={() => setAll(!all)}
          className="mt-1 px-3 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground"
        >
          {all ? "Show less" : `See all (${s.items.length})`}
        </button>
      )}
    </div>
  );
}
