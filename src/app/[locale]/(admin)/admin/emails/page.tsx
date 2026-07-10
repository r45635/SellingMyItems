import { db } from "@/db";
import { emailLogs, appSettings } from "@/db/schema";
import { count, eq, sql, and, gte, desc } from "drizzle-orm";
import { getTranslations, getLocale } from "next-intl/server";
import { Mail, AlertTriangle, CheckCircle, Key } from "lucide-react";
import { UpdateResendKeyForm } from "@/features/admin-dashboard/components/update-resend-key-form";
import { UpdateResendFromEmailForm } from "@/features/admin-dashboard/components/update-resend-from-email-form";
import { Pagination } from "@/components/shared/pagination";

const LOG_PAGE_SIZE = 30;

export default async function AdminEmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const t = await getTranslations("admin.emails");
  const locale = await getLocale();
  const currentPage = Math.max(1, Number(pageParam) || 1);
  const logOffset = (currentPage - 1) * LOG_PAGE_SIZE;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thirtyDaysAgo = new Date(
    now.getTime() - 30 * 24 * 60 * 60 * 1000
  );

  const [
    todayByType,
    todayFailed,
    last30DaysDaily,
    recentLogs,
    totalLogCountResult,
    resendKeySetting,
    resendFromEmailSetting,
  ] = await Promise.all([
    // Today's emails by type
    db
      .select({
        type: emailLogs.type,
        count: count(),
      })
      .from(emailLogs)
      .where(gte(emailLogs.createdAt, todayStart))
      .groupBy(emailLogs.type),

    // Today's failed emails
    db
      .select({ count: count() })
      .from(emailLogs)
      .where(
        and(
          gte(emailLogs.createdAt, todayStart),
          eq(emailLogs.status, "failed")
        )
      ),

    // Last 30 days daily breakdown
    db
      .select({
        day: sql<string>`DATE(${emailLogs.createdAt})`.as("day"),
        sent: sql<number>`COUNT(*) FILTER (WHERE ${emailLogs.status} = 'sent')`.as(
          "sent"
        ),
        failed: sql<number>`COUNT(*) FILTER (WHERE ${emailLogs.status} = 'failed')`.as(
          "failed"
        ),
      })
      .from(emailLogs)
      .where(gte(emailLogs.createdAt, thirtyDaysAgo))
      .groupBy(sql`DATE(${emailLogs.createdAt})`)
      .orderBy(sql`DATE(${emailLogs.createdAt}) DESC`),

    // Paginated email logs + total count
    db
      .select({
        id: emailLogs.id,
        toEmail: emailLogs.toEmail,
        subject: emailLogs.subject,
        type: emailLogs.type,
        status: emailLogs.status,
        errorMessage: emailLogs.errorMessage,
        createdAt: emailLogs.createdAt,
      })
      .from(emailLogs)
      .orderBy(desc(emailLogs.createdAt))
      .limit(LOG_PAGE_SIZE)
      .offset(logOffset),

    db.select({ count: count() }).from(emailLogs),

    // Resend API key from app_settings
    db.query.appSettings.findFirst({
      where: eq(appSettings.key, "resend_api_key"),
      columns: { value: true, updatedAt: true },
    }),

    // Resend from email from app_settings
    db.query.appSettings.findFirst({
      where: eq(appSettings.key, "resend_from_email"),
      columns: { value: true, updatedAt: true },
    }),
  ]);

  const todayTotal = todayByType.reduce((sum, r) => sum + Number(r.count), 0);
  const todayFailedCount = Number(todayFailed[0]?.count ?? 0);
  const totalLogItems = Number(totalLogCountResult[0]?.count ?? 0);
  const totalLogPages = Math.ceil(totalLogItems / LOG_PAGE_SIZE);

  // Email types come from a fixed enum; unknown values fall back to the raw
  // key so a new type never renders blank before its label is translated.
  const typeLabel = (type: string) =>
    t.has(`type.${type}`) ? t(`type.${type}`) : type;

  const statusBadge = (status: string) => {
    if (status === "sent") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
          <CheckCircle className="h-3 w-3" /> {t("statusSent")}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
        <AlertTriangle className="h-3 w-3" /> {t("statusFailed")}
      </span>
    );
  };

  const maskedKey = resendKeySetting?.value
    ? resendKeySetting.value.slice(0, 8) + "••••••••" + resendKeySetting.value.slice(-4)
    : t("usingEnvVariable");

  const fromEmailValue =
    resendFromEmailSetting?.value ??
    process.env.RESEND_FROM_EMAIL ??
    "SellingMyItems <onboarding@resend.dev>";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t("subtitle")}
        </p>
      </div>

      {/* Today's Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <Mail className="h-5 w-5 text-blue-500" />
            <h3 className="text-sm font-medium text-muted-foreground">
              {t("emailsToday")}
            </h3>
          </div>
          <p className="text-3xl font-bold">{todayTotal}</p>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <h3 className="text-sm font-medium text-muted-foreground">
              {t("failedToday")}
            </h3>
          </div>
          <p className="text-3xl font-bold">{todayFailedCount}</p>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <Key className="h-5 w-5 text-amber-500" />
            <h3 className="text-sm font-medium text-muted-foreground">
              {t("apiKey")}
            </h3>
          </div>
          <p className="text-sm font-mono truncate">{maskedKey}</p>
          {resendKeySetting?.updatedAt && (
            <p className="text-xs text-muted-foreground mt-1">
              {t("updated", {
                date: new Date(resendKeySetting.updatedAt).toLocaleDateString(
                  locale
                ),
              })}
            </p>
          )}
        </div>
      </div>

      {/* Today by Type */}
      {todayByType.length > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold mb-3">{t("todayByType")}</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {todayByType.map((row) => (
              <div key={row.type} className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">
                  {typeLabel(row.type)}
                </p>
                <p className="text-xl font-bold mt-1">{Number(row.count)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last 30 days */}
      {last30DaysDaily.length > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold mb-3">{t("last30Days")}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-4">{t("date")}</th>
                  <th className="text-right py-2 px-2">{t("sent")}</th>
                  <th className="text-right py-2 pl-2">{t("failed")}</th>
                </tr>
              </thead>
              <tbody>
                {last30DaysDaily.map((row) => (
                  <tr key={row.day} className="border-b last:border-0">
                    <td className="py-1.5 pr-4 font-mono text-xs">{row.day}</td>
                    <td className="text-right py-1.5 px-2 text-green-600">
                      {Number(row.sent)}
                    </td>
                    <td className="text-right py-1.5 pl-2 text-red-600">
                      {Number(row.failed)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Email Logs */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h3 className="text-sm font-semibold mb-3">
          {t("logsTitle", { count: totalLogItems })}
        </h3>
        {recentLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noEmails")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-2">{t("table.to")}</th>
                  <th className="text-left py-2 px-2">{t("table.type")}</th>
                  <th className="text-left py-2 px-2">{t("table.subject")}</th>
                  <th className="text-left py-2 px-2">{t("table.status")}</th>
                  <th className="text-right py-2 pl-2">{t("table.date")}</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((log) => (
                  <tr key={log.id} className="border-b last:border-0">
                    <td className="py-1.5 pr-2 max-w-[180px] truncate font-mono text-xs">
                      {log.toEmail}
                    </td>
                    <td className="py-1.5 px-2 text-xs">
                      {typeLabel(log.type)}
                    </td>
                    <td className="py-1.5 px-2 max-w-[200px] truncate text-xs">
                      {log.subject}
                    </td>
                    <td className="py-1.5 px-2">{statusBadge(log.status)}</td>
                    <td className="text-right py-1.5 pl-2 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString(locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          currentPage={currentPage}
          totalPages={totalLogPages}
          totalItems={totalLogItems}
          pageSize={LOG_PAGE_SIZE}
        />
      </div>

      {/* Update Resend API Key */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Key className="h-4 w-4" />
          {t("updateKeyTitle")}
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          {t("updateKeyDesc")}
        </p>
        <UpdateResendKeyForm />
      </div>

      {/* Update Resend From Email */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Mail className="h-4 w-4" />
          {t("updateFromTitle")}
        </h3>
        <p className="text-xs text-muted-foreground mb-2">
          {t("currentSender")} <span className="font-mono">{fromEmailValue}</span>
        </p>
        <p className="text-xs text-muted-foreground mb-4">
          {t("updateFromDesc")}
        </p>
        <UpdateResendFromEmailForm />
      </div>
    </div>
  );
}
