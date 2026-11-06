import { PageHeading } from "../../components/page-heading";
import { recentAlerts } from "../../lib/alerts";
import { money, text, time } from "../../lib/format";
import { cx, ui } from "../../lib/ui";
import { testNotificationAction } from "./actions";

export const dynamic = "force-dynamic";

type NotificationsProps = {
  searchParams: Promise<{ message?: string }>;
};

export default async function Notifications({
  searchParams,
}: NotificationsProps) {
  const { message } = await searchParams;
  const events = recentAlerts();

  return (
    <>
      <PageHeading
        title="Windows notifications"
        description="Automatic local alerts when a newly accepted scraped best price is at or below its target. Each best-price state is alerted at most once."
      />

      {message && (
        <div
          className={cx(
            ui.note,
            message === "sent" ? ui.successNote : ui.errorNote,
          )}
        >
          {message === "sent"
            ? "Notification submitted to Windows. Visibility depends on Windows notification settings."
            : "Windows notification failed. Check the Next.js terminal and that you are signed into the Windows desktop."}
        </div>
      )}

      <section className={ui.panel}>
        <h2 className={ui.sectionTitle}>Desktop notification</h2>
        <form action={testNotificationAction}>
          <button className={ui.secondaryButton} type="submit">
            Send test notification
          </button>
        </form>
      </section>

      <section className={ui.panel}>
        <h2 className={ui.sectionTitle}>Recent price alerts</h2>
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th className={ui.th}>Item</th>
                <th className={ui.th}>Price / target</th>
                <th className={ui.th}>Status</th>
                <th className={ui.th}>When</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={text(event.id)}>
                  <td className={ui.td}>{event.name || "—"}</td>
                  <td className={ui.td}>
                    {money(event.unit_price)} / {money(event.target_unit_price)}{" "}
                    {text(event.currency)}
                  </td>
                  <td className={ui.td}>
                    <span
                      className={cx(
                        ui.tag,
                        event.status === "Sent" && ui.tagGood,
                        event.status === "Failed" && ui.tagBad,
                        event.status !== "Sent" &&
                          event.status !== "Failed" &&
                          ui.tagNeutral,
                      )}
                    >
                      {event.status === "Sent" ? "Notified" : text(event.status)}
                    </span>
                    {event.error && <p className={ui.small}>{text(event.error)}</p>}
                  </td>
                  <td className={ui.td}>
                    {time(event.sent_at || event.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {events.length === 0 && (
          <div className={ui.empty}>No price alerts yet.</div>
        )}
      </section>
    </>
  );
}
