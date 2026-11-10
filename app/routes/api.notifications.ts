import { data } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/api.notifications";
import { getCurrentUserId } from "~/lib/session";
import { parseFormData } from "~/lib/validation";
import { db } from "~/db";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "~/lib/notifications.server";

// The sidebar's "For you" feed: "See all" loads the full list from here, and
// following a Notification or "Mark all read" posts here. The unread count and
// the newest unread come from the app layout loader, which revalidates after
// these actions.

const notificationActionSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("mark-read"),
    notificationId: z.coerce.number().int().positive(),
  }),
  z.object({ intent: z.literal("mark-all-read") }),
]);

export async function loader({ request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Unauthorized", { status: 401 });
  }

  return { notifications: listNotifications(db, currentUserId) };
}

export async function action({ request }: Route.ActionArgs) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Unauthorized", { status: 401 });
  }

  const parsed = parseFormData(
    await request.formData(),
    notificationActionSchema
  );
  if (!parsed.success) {
    throw data("Invalid parameters", { status: 400 });
  }

  if (parsed.data.intent === "mark-read") {
    markNotificationRead(db, currentUserId, parsed.data.notificationId);
  } else {
    markAllNotificationsRead(db, currentUserId);
  }

  return { success: true };
}
