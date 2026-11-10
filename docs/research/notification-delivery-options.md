# How can a Notification reach a Recipient already on a page?

Research for [#3](https://github.com/SuperJoran/cohort-005-project/issues/3), part of map [#1 Wayfinder: In-app notifications](https://github.com/SuperJoran/cohort-005-project/issues/1). The decision belongs to [#4 "Live, polled, or next page load?"](https://github.com/SuperJoran/cohort-005-project/issues/4). This file lists the options and their trade-offs and gives a leaning. It does not make the decision.

Researched 2026-11-10.

## Ground truth about Cadence (from the repo)

- **Router version.** `package.json` pins `react-router`, `@react-router/node`, `@react-router/serve` and `@react-router/dev` at **8.3.0**, not v7. The installed `node_modules/react-router/package.json` also says 8.3.0. The APIs used below (`loader`, resource routes, `useRevalidator`, `useFetcher`, `shouldRevalidate`) all exist in v8 as they did in v7. The docs quoted here are the current reactrouter.com pages, which link to the `api.reactrouter.com/v8` reference.
- **Framework mode with SSR.** `react-router.config.ts` sets `ssr: true`.
- **Production server.** `npm start` runs `react-router-serve`. That is Express with `compression()` mounted in front of every request (`node_modules/@react-router/serve/dist/cli.js`: `if (!isRSCBuild) app.use(compression());`).
- **Database.** `app/db/index.ts` opens one `better-sqlite3` connection to `data.db`, lazily, per Node process. It sets `journal_mode = WAL` and `foreign_keys = ON`, and wraps the connection in Drizzle. better-sqlite3 is synchronous, so every query blocks the event loop while it runs.
- **ADR 0006** ("one SQLite file through Drizzle") is not in this checkout or on `origin/main`. The constraint is taken from the map's Notes and from `app/db/index.ts`.
- **The layout loader is heavy.** `app/routes/layout.app.tsx` wraps almost every page. Its `loader` loads all users, the current user, team-admin status and the recent courses, and for each recent course it runs several progress queries. This matters for polling, because revalidation re-runs it (see Option B).

## Option A: next navigation / page load only

**How it fits.** Put the Notifications (or an unread count) in the `layout.app.tsx` loader. In framework mode with SSR, "route loaders are automatically revalidated after all navigations and form submissions" ([Route Module, shouldRevalidate](https://reactrouter.com/start/framework/route-module)). Actions called "from `<Form>`, `useFetcher`, and `useSubmit`" revalidate "all loader data on the page" (same page). The bell refreshes whenever the Recipient clicks a link or submits anything.

**SQLite/Drizzle.** One extra indexed query per navigation, on a request the app already serves. There are no long-lived connections and nothing new runs concurrently.

**Complexity.** Lowest. There is no new route, timer or client code.

**Pitfalls.**
- A Recipient who sits on one page (watching a lesson video, say) never sees new Notifications until they act.
- Adding the query to the layout loader makes it a little heavier, and that loader already runs on every navigation.

**Fit with the map's destination.** The map says "the Recipient sees them in the app **when they next visit**". Taken literally, Option A already meets that.

## Option B: polling

There are two shapes.

### B1: `useRevalidator` on an interval or on focus

`useRevalidator` exists to "revalidate the data on the page for reasons outside of normal data mutations like `Window` focus or polling on an interval". It returns `{ revalidate, state }` ([useRevalidator](https://reactrouter.com/api/hooks/useRevalidator)). The docs' only example is window focus. They add that you shouldn't use it for normal CRUD, which already revalidates.

**Cost.** `revalidate()` re-runs the loaders of **every matched route**, not just the notifications query. In Cadence that always includes the heavy `layout.app.tsx` loader plus the page's own loader. A 30-second interval per open tab multiplies all that synchronous SQLite work. `shouldRevalidate` can opt a route out, but only "for **this route's** loader. It does not skip parent or sibling loaders". It also warns that always returning `false` "can leave this route's UI out of sync" ([Route Module](https://reactrouter.com/start/framework/route-module)).

### B2: `useFetcher().load()` against a small resource route

A route module that exports a `loader` and no default component is a resource route ([Resource Routes](https://reactrouter.com/how-to/resource-routes)). Say `api/notifications`, returning `data({ unreadCount, latest })`. The docs suggest returning `data()` when fetchers consume the route. Calling `fetcher.load("/api/notifications")` from the layout on a timer or on focus only runs **that** loader, "without causing a navigation" ([useFetcher](https://reactrouter.com/api/hooks/useFetcher)). This keeps the bell fresh without re-running the layout's progress queries.

**Shared considerations for B1/B2.**
- **Pause when hidden.** `visibilitychange` fires when a tab is hidden or shown. MDN calls the switch to `hidden` "a good point at which pages can stop making UI updates and stop any tasks that the user doesn't want to have running in the background" ([MDN visibilitychange](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event)). Check on focus/visible as well as on the interval, so a returning Recipient gets fresh data immediately.
- **SQLite/Drizzle.** Each poll is one short read. WAL means "readers do not block writers and a writer does not block readers", though "there can only be one writer at a time", and a query can rarely return `SQLITE_BUSY` ([SQLite WAL](https://www.sqlite.org/wal.html)). Polling reads don't compete with the writes that create Notifications. Poll cost scales as tabs × (1 / interval).
- **Proxies, HMR, deployment.** These are ordinary short requests, so buffering proxies, idle timeouts and connection limits don't matter. Polling works the same under `react-router dev` and `react-router-serve`, and on any host.
- **Latency.** Freshness is at most one interval stale, or instant on tab focus.
- **Complexity.** Low. One resource route, one small hook (`setInterval` plus `visibilitychange`), and a test for the resource route's loader.

## Option C: Server-Sent Events from a resource route

**How it fits.** A resource route `loader` can return any `Response` ([Resource Routes](https://reactrouter.com/how-to/resource-routes)). It can return `new Response(readableStream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } })`. The client opens `new EventSource("/api/notifications/stream")` in a `useEffect` in the layout. The spec requires `Content-Type: text/event-stream` and status 200. Otherwise the client fails the connection and "does not attempt to reconnect" ([WHATWG HTML §9.2 Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html)).

**Built-in behaviour (spec).** "Clients will reconnect if the connection is closed". The server can tune this with `retry:`. On reconnect, the `Last-Event-ID` header "reports an EventSource object's last event ID string to the server", which lets the server replay missed Notifications. A 204 response tells the client to stop reconnecting ([WHATWG](https://html.spec.whatwg.org/multipage/server-sent-events.html)).

**How the server knows there is something new: the hard part with SQLite.**
- SQLite does not push changes to readers. `sqlite3_update_hook` is registered on one database connection and fires when that connection updates, inserts or deletes rows. Its docs say nothing about other connections, and the hook "must not do anything that will modify the database connection" ([SQLite update_hook](https://www.sqlite.org/c3ref/update_hook.html)). It is not a cross-process change feed.
- That leaves two designs:
  1. **In-process event bus.** The code that inserts a Notification also emits on a Node `EventEmitter`, and open streams for that Recipient write an event. This only works while Cadence runs as **one Node process**. A second instance, or a cluster, misses events unless you add a broker, which leaves the one-SQLite-file architecture.
  2. **Server-side polling per stream.** Each open stream re-queries SQLite every N seconds. This is polling again, only moved to the server. It also keeps a long-lived request and a timer per tab, and better-sqlite3's queries are synchronous on the shared event loop.

**Pitfalls.**
- **Connection limits.** Without HTTP/2, the browser allows a "very low number (6)" of connections, "per browser + domain" across **all tabs**, and Chrome and Firefox marked this "Won't fix" ([MDN EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)). Several Cadence tabs on HTTP/1.1 can exhaust the pool and stall ordinary navigations. The spec suggests per-page enable/disable or sharing one EventSource through a shared worker ([WHATWG](https://html.spec.whatwg.org/multipage/server-sent-events.html)). `react-router-serve` speaks HTTP/1.1. HTTP/2 needs a TLS-terminating proxy in front.
- **Proxies and buffering.**
  - nginx has `proxy_buffering on` by default. Disable it per response with `X-Accel-Buffering: no`.
  - nginx `proxy_read_timeout` defaults to 60s between reads, then "the connection is closed" ([nginx proxy module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)).
  - The spec notes legacy proxies "drop HTTP connections after a short timeout" and recommends a comment line (`:`) "every 15 seconds or so" ([WHATWG](https://html.spec.whatwg.org/multipage/server-sent-events.html)).
  - So you need a heartbeat and the header.
- **`compression()` in `react-router-serve`.** The compression README warns that it buffers output, and for SSE you must call `res.flush()` after each event (`node_modules/compression/README.md`, "Server-Sent Events"). In the installed version, `@react-router/node`'s `writeReadableStreamToWritable` calls `flush()` after every chunk when the writable has one (`node_modules/@react-router/node/dist/index.js`, `if (typeof flushable.flush === "function") flushable.flush();`). Events should therefore get through. You could also send `Cache-Control: no-transform`, which compression respects (`node_modules/compression/index.js`). Verify this in an end-to-end test rather than assume it.
- **Cleanup.** `@react-router/express` aborts the request's signal when the response closes (`res.on("close", () => controller?.abort())` in `node_modules/@react-router/express/dist/index.js`). The stream must listen to `request.signal` to clear its heartbeat timer and unsubscribe from the bus. Otherwise each disconnected tab leaks listeners.
- **Dev server / HMR.** Under `react-router dev` (Vite), long-lived responses stay open across server-module reloads. A re-evaluated module can create a second `EventEmitter`, leaving old streams subscribed to a dead bus. Expect stale streams until the page reloads. This is an inference from module re-evaluation, not a documented guarantee, so test it.
- **Deployment.** Serverless or edge hosts often cap response duration, and any multi-instance deployment breaks the in-process bus. Both conflict with or complicate the single-SQLite-file setup, which already implies one host: "WAL does not work over a network filesystem" ([SQLite WAL](https://www.sqlite.org/wal.html)).
- **Auth.** `EventSource` sends cookies for same-origin URLs, so the session cookie (`getCurrentUserId(request)`) works. Switching users in the DevUI won't re-open the stream unless the effect depends on the user id.

**Complexity.** Highest. You need a stream route, an event bus, heartbeats, abort cleanup, client lifecycle handling, a connection-limit mitigation and proxy configuration. It is also harder to test with Vitest than a plain loader.

## Comparison

| | Next navigation | Polling (fetcher + resource route) | SSE |
|---|---|---|---|
| Freshness while idle on a page | none | ≤ interval; instant on focus | ~instant |
| New server code | 1 query in layout loader | 1 resource route | stream route + event bus + heartbeat |
| SQLite load | per navigation | per tab per interval (short reads, WAL-friendly) | per event (bus) or per stream per tick |
| Works with >1 Node process | yes | yes | only with server-side polling or an external broker |
| Proxy / buffering concerns | none | none | buffering, idle timeouts, compression flush |
| Browser connection limits | none | none | 6 per domain on HTTP/1.1 across tabs |
| Dev/HMR quirks | none | none | stale streams/buses after reloads |
| Testability (Vitest) | trivial | trivial | harder |

## Leaning (for #4 to accept or reject)

- **Start with Option A plus B2.** Put unread Notifications in the layout loader so every navigation and action refreshes them for free. Add a lightweight `fetcher.load` of a dedicated `api/notifications` resource route on window focus / `visibilitychange`, optionally on a modest interval (30–60s) while the tab is visible.
- **Avoid B1 (`useRevalidator` on an interval) as written.** Every tick would re-run the heavy `layout.app.tsx` loader.
- **Hold SSE back** until there is a Notification kind where seconds matter. The map's destination ("sees them … when they next visit") does not need it. SSE's real costs are connection limits, proxy buffering, the in-process bus tying Cadence to one Node process, and HMR quirks. Those are disproportionate for that goal. If you adopt SSE later, the B2 resource route's query is the same one a stream would send, so nothing is wasted.

The open questions for #4:
- Does any Notification need to be seen within seconds?
- Is "on focus + next navigation" enough, or do you also want an interval?
- If an interval, how long?
