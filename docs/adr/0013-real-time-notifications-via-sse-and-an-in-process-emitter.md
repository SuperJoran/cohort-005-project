# Push unread Notification counts in real time over SSE, from an in-process emitter

Recipients see their unread Notification count change live while they sit on a page. Nothing in v1 strictly needs to be seen within seconds: Email already brings people back, and polling would have been good enough technically. We chose real time for the product experience. Each visible tab holds one Server-Sent Events connection to `api/notifications/stream`, and the server pushes that user's current unread count whenever it changes. Changes come from an in-process event emitter, which `notify` fires after its transaction commits, as does any read that changes the count. SQLite has no change feed across connections, so the emitter only works because Cadence is one server process (ADR 0006). This ADR leans on that assumption on purpose.

## Considered Options

- **Next page load only.** Rejected: a Recipient sitting on one page would see nothing new.
- **Fetcher poll every few seconds of a small resource route.** Rejected: it is never truly instant, and it sends a request per tab every few seconds. Technically it would have been enough.

## Consequences

- **Leaving one process.** Running more than one process means replacing the emitter with a shared bus (Redis pub/sub, Postgres `LISTEN`/`NOTIFY`). Until then the push is a no-op for users on another process.
- **Connection limit.** `react-router-serve` speaks HTTP/1.1, where browsers allow 6 connections per domain across all tabs. So a tab closes its stream when hidden and reopens it when visible.
- **Lost messages don't matter.** The stream carries only the unread count, and sends it first on every connect. Missed messages need no replay.
- **Proxies.** They buffer and idle-close streams, so the route sends `X-Accel-Buffering: no` and a heartbeat every 15s.
