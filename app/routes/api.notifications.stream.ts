import { data } from "react-router";
import type { Route } from "./+types/api.notifications.stream";
import { getCurrentUserId } from "~/lib/session";
import { db } from "~/db";
import { unreadCountStream } from "~/lib/notification-stream.server";

// The live unread badge (ADR 0013): each visible tab holds one EventSource on
// this route, which pushes the Recipient's unread Notification count.

export async function loader({ request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Unauthorized", { status: 401 });
  }

  return unreadCountStream(db, currentUserId, request.signal);
}
