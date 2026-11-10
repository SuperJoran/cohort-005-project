# Delay re-engagement Email through a stored row and an in-process sweeper

Re-engagement Emails (reply, new top-level comment, new Open Refund Request) are meant for people who are not in the app, so they wait 15 minutes and are skipped if the Recipient has read the matching Notification by then. `notify` writes a `pending_emails` row with a `send_after` time in the same transaction as the Notification. A `setInterval` sweeper inside the server process, started once from a `.server` module with a guard against dev hot reload, checks due rows every minute. It skips the row if the Notification is read, the comment is deleted, or the Refund Request is no longer Open. Otherwise it builds the Email at send time, so it uses the Recipient's current address, and sends it. It retries a failed send on later sweeps, up to 3 attempts, then marks the row failed and logs it. Refund Request decided is transactional and is still sent right after its transaction is saved. Like ADR 0013, the sweeper only works because Cadence is one server process (ADR 0006).

## Considered Options

- **Send immediately after the transaction is saved.** Rejected: Recipients who are in the app, already watching the live badge, would get an Email they don't need.
- **Skip if the Recipient has an open stream.** Rejected: an open tab doesn't mean the Recipient saw the Notification. The read state shows that they did.
- **In-memory `setTimeout`.** Rejected: every pending Email is lost on a restart or redeploy.
- **An external cron calling a protected route.** Rejected: there is no deploy config to put it in, so it adds infrastructure for no gain while Cadence is one process.

## Consequences

- **Leaving one process.** Running two processes would run two sweepers. Rows would have to be claimed atomically before sending, or the sweeper moved to a single worker.
- **Late, not lost.** While the server is down, due Emails wait, and they go out on the first sweep after startup.
- **Emails can arrive up to about 75 minutes late.** That's because of the batching cooldown below. The Notification in the app is still live.

## Batching

When the sweeper sends a due row, it also takes every other pending row for the same Recipient and **kind**, including rows that aren't due yet, and sends them as one Email. Rows the Recipient has turned off are dropped before grouping. After a **successful** send, that Recipient gets no other Email of that kind for **1 hour** (one constant, like the 15-minute delay). Rows that come due during that hour wait and go out together when it ends. The cooldown is worked out from the newest sent row for that Recipient and kind, so there's no extra table. A failed send counts an attempt for every row in the batch. On the next sweep the rows are grouped again, and the retry may include more items.

The Email's subject is a count and the kind ("3 new replies to your comments"). The body has one linked line per item, newest first and at most 10, then "and N more", which links into the app. A batch of one reads like a single Email. Links are plain and don't mark the Notification read. The footer has the one-kind unsubscribe link from ADR 0015.

### Considered Options

- **One Email per event.** Rejected: a burst of 20 replies means 20 Emails, and that pushes people to "report spam".
- **One mixed digest per Recipient across kinds.** Rejected: one unsubscribe link (ADR 0015) and one `List-Unsubscribe` header can only cover one kind.
- **Debounce (every new row pushes the send back).** Rejected: a steady trickle would never send without adding a maximum wait.
- **Pull forward with no cooldown.** Rejected: a trickle still means an Email every 15 minutes.
