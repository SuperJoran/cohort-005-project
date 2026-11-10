import {
  countUnread,
  subscribeToUnreadCount,
  type Db,
} from "~/lib/notifications.server";

// ─── Unread count stream ───
// One Server-Sent Events stream per visible tab (ADR 0013). It carries only the
// Recipient's unread Notification count: the current count first on every
// connect, so a missed message needs no replay, then each new count. A comment
// line every 15s keeps proxies from idle-closing it.

const HEARTBEAT_MS = 15_000;

export function unreadCountStream(
  db: Db,
  recipientId: number,
  signal: AbortSignal
): Response {
  const encoder = new TextEncoder();
  let close = () => {};

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => controller.enqueue(encoder.encode(chunk));
      const sendCount = (unreadCount: number) =>
        send(`data: ${unreadCount}\n\n`);

      const unsubscribe = subscribeToUnreadCount(recipientId, sendCount);
      const heartbeat = setInterval(() => send(": heartbeat\n\n"), HEARTBEAT_MS);
      let closed = false;
      close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        signal.removeEventListener("abort", onAbort);
      };
      const onAbort = () => {
        close();
        controller.close();
      };

      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort);
      sendCount(countUnread(db, recipientId));
    },
    cancel() {
      close();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
