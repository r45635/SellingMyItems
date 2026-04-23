import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";
import { listNotifications } from "@/lib/notifications";
import { Bell, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "@/features/notifications/actions";

const LABELS_FR = {
  title: "Notifications",
  empty: "Aucune notification.",
  markAll: "Tout marquer comme lu",
  view: "Voir",
  markRead: "Marquer lu",
};
const LABELS_EN = {
  title: "Notifications",
  empty: "No notifications.",
  markAll: "Mark all as read",
  view: "View",
  markRead: "Mark read",
};

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser();
  const labels = locale === "fr" ? LABELS_FR : LABELS_EN;
  const rows = await listNotifications(user.id, 50);
  const hasUnread = rows.some((r) => !r.readAt);

  return (
    <div className="container px-4 md:px-6 py-6 max-w-3xl">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="h-5 w-5" />
          {labels.title}
        </h1>
        {hasUnread && (
          <form action={markAllNotificationsReadAction}>
            <Button type="submit" variant="outline" size="sm">
              <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
              {labels.markAll}
            </Button>
          </form>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-12 text-center text-muted-foreground">
          {labels.empty}
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((n) => (
            <li
              key={n.id}
              className={`rounded-lg border p-3 ${
                !n.readAt ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900" : "bg-card"
              }`}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">{n.title}</p>
                    {!n.readAt && (
                      <Badge variant="outline" className="text-[10px]">
                        NEW
                      </Badge>
                    )}
                  </div>
                  {n.body && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {n.body}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    {new Date(n.createdAt).toLocaleString(
                      locale === "fr" ? "fr-FR" : "en-US"
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {n.linkUrl && (
                    <Link
                      href={n.linkUrl}
                      className="inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-medium hover:bg-muted"
                    >
                      {labels.view}
                    </Link>
                  )}
                  {!n.readAt && (
                    <form action={markNotificationReadAction.bind(null, n.id)}>
                      <button
                        type="submit"
                        className="inline-flex h-8 items-center rounded-md px-2 text-xs text-muted-foreground hover:bg-muted"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
