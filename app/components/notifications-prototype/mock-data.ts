// PROTOTYPE — throwaway. Mock Notifications for the v1 event list
// ("Which events notify whom?"), per Recipient role. No persistence.
import { UserRole } from "~/db/schema";

export type NotificationKind =
  | "refund-decided"
  | "reply"
  | "new-comment"
  | "new-refund-request"
  | "seat-claimed";

export interface ProtoNotification {
  id: number;
  kind: NotificationKind;
  text: string;
  href: string;
  minutesAgo: number;
  read: boolean;
}

const MIN = 1;
const HOUR = 60;
const DAY = 24 * HOUR;

const student: ProtoNotification[] = [
  { id: 1, kind: "reply", text: "Priya Shah replied to your comment on “Union and Intersection Types”", href: "/courses/introduction-to-typescript", minutesAgo: 4 * MIN, read: false },
  { id: 2, kind: "reply", text: "Tom Becker replied to your comment on “Primitive Types”", href: "/courses/introduction-to-typescript", minutesAgo: 52 * MIN, read: false },
  { id: 3, kind: "refund-decided", text: "Your Refund Request for Design Systems with Tailwind was approved", href: "/courses/design-systems-with-tailwind", minutesAgo: 3 * HOUR, read: false },
  { id: 4, kind: "reply", text: "Ana Costa replied to your comment on “Your First TypeScript Program”", href: "/courses/introduction-to-typescript", minutesAgo: 2 * DAY, read: true },
  { id: 5, kind: "refund-decided", text: "Your Refund Request for Practical Data Visualisation was declined", href: "/courses/practical-data-visualisation", minutesAgo: 9 * DAY, read: true },
];

const instructor: ProtoNotification[] = [
  { id: 11, kind: "new-comment", text: "New question on “Arrays and Tuples” in Introduction to TypeScript", href: "/instructor/questions", minutesAgo: 2 * MIN, read: false },
  { id: 12, kind: "new-comment", text: "New question on “Primitive Types” in Introduction to TypeScript", href: "/instructor/questions", minutesAgo: 18 * MIN, read: false },
  { id: 13, kind: "new-comment", text: "New question on “Type Aliases and Interfaces” in Introduction to TypeScript", href: "/instructor/questions", minutesAgo: 41 * MIN, read: false },
  { id: 14, kind: "reply", text: "Priya Shah replied to your comment on “What is TypeScript?”", href: "/courses/introduction-to-typescript", minutesAgo: 5 * HOUR, read: false },
  { id: 15, kind: "new-comment", text: "New question on “Installing and Configuring TypeScript” in Introduction to TypeScript", href: "/instructor/questions", minutesAgo: 1 * DAY + 3 * HOUR, read: true },
  { id: 16, kind: "new-comment", text: "New question on “Your First TypeScript Program” in Introduction to TypeScript", href: "/instructor/questions", minutesAgo: 6 * DAY, read: true },
];

const admin: ProtoNotification[] = [
  { id: 21, kind: "new-refund-request", text: "Lena Fischer requested a Refund for Building REST APIs with Node.js", href: "/admin/refunds", minutesAgo: 6 * MIN, read: false },
  { id: 22, kind: "new-refund-request", text: "Acme Corp requested a Refund for Shipping with Docker and Kubernetes", href: "/admin/refunds", minutesAgo: 25 * MIN, read: false },
  { id: 23, kind: "new-refund-request", text: "Marco Rossi requested a Refund for Introduction to TypeScript", href: "/admin/refunds", minutesAgo: 2 * HOUR, read: false },
  { id: 24, kind: "new-refund-request", text: "Yuki Tanaka requested a Refund for Design Systems with Tailwind", href: "/admin/refunds", minutesAgo: 1 * DAY, read: true },
  { id: 25, kind: "new-refund-request", text: "Sam Okafor requested a Refund for Practical Data Visualisation", href: "/admin/refunds", minutesAgo: 4 * DAY, read: true },
];

// Team Admins are Students in Cadence; they also get Seat claimed.
const teamAdminExtras: ProtoNotification[] = [
  { id: 31, kind: "seat-claimed", text: "Jonas Peeters claimed a Seat on Introduction to TypeScript", href: "/team", minutesAgo: 12 * MIN, read: false },
  { id: 32, kind: "seat-claimed", text: "Eva Janssens claimed a Seat on Introduction to TypeScript", href: "/team", minutesAgo: 30 * MIN, read: false },
  { id: 33, kind: "refund-decided", text: "Your Refund Request for Shipping with Docker and Kubernetes was approved", href: "/courses/shipping-with-docker-and-kubernetes", minutesAgo: 2 * DAY, read: true },
  { id: 34, kind: "seat-claimed", text: "Lucas Maes claimed a Seat on Building REST APIs with Node.js", href: "/team", minutesAgo: 3 * DAY, read: true },
];

export function mockNotificationsFor(
  role: UserRole | null,
  isTeamAdmin: boolean
): ProtoNotification[] {
  if (!role) return [];
  let list: ProtoNotification[] = [];
  if (role === UserRole.Student) list = [...student];
  if (role === UserRole.Instructor) list = [...instructor];
  if (role === UserRole.Admin) list = [...admin];
  if (isTeamAdmin) list = [...list, ...teamAdminExtras];
  return list.sort((a, b) => a.minutesAgo - b.minutesAgo);
}

export function timeAgo(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < DAY) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / DAY)}d`;
}

export function dayBucket(minutes: number): "Today" | "This week" | "Earlier" {
  if (minutes < DAY) return "Today";
  if (minutes < 7 * DAY) return "This week";
  return "Earlier";
}

export const kindLabel: Record<NotificationKind, string> = {
  "refund-decided": "Refunds",
  "new-refund-request": "Refund Requests",
  reply: "Replies",
  "new-comment": "Questions",
  "seat-claimed": "Team",
};
