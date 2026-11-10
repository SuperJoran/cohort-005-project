# Unsubscribe through a stateless, never-expiring signed link

Every Re-engagement Email carries an unsubscribe link (in the footer and in `List-Unsubscribe` / `List-Unsubscribe-Post`) that turns off that one kind of Email for that one Recipient, in one click and without signing in. The link carries the user id, the kind and an HMAC of both, keyed by a server secret from the environment (`APP_SECRET`, with a dev fallback like the session secret). Nothing is stored for a link, and it never expires, so an Email from months ago still unsubscribes. Turning a kind off writes an opt-out row, and the sweeper skips pending Emails for kinds that are turned off.

## Considered Options

- **Link to `/settings` behind sign-in.** Rejected: people read Email on phones where they aren't signed in, mail apps only show their own unsubscribe button for one-click links, and a hard unsubscribe pushes people to "report spam" instead.
- **A stored, expiring token per Email.** Rejected: it needs a table and cleanup, and an old Email's link stops working. The link can only turn one kind of Email off for one person, which is undone in `/settings`, so a leaked link is low risk.

## Consequences

- **The link format is frozen.** Links in Emails already sent keep working only while the format and secret stay valid. Changing either means accepting old links as well for a while.
- **Rotating `APP_SECRET` breaks every unsubscribe link already sent.** Rotate by checking against both the old and new secret during a grace period.
- **Links can't be revoked one at a time.** That's acceptable because the only thing a link can do is turn one kind of Email off.
