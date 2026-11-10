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
- **Batching.** Pending rows are where Emails to the same Recipient can be grouped later ("How are bursts of Emails batched?").
