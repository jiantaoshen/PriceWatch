import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "../../../components/page-heading";
import { PriceChart } from "../../../components/price-chart";
import { money, text, time } from "../../../lib/format";
import { itemDetails } from "../../../lib/queries";
import { cx, ui } from "../../../lib/ui";
import {
  addPriceAction,
  addSourceAction,
  archiveItemAction,
  archiveSourceAction,
  restoreSourceAction,
  excludeSuspiciousPriceAction,
  setSourceScrapingAction,
  restoreItemAction,
  saveItemAction,
} from "../../actions";

export const dynamic = "force-dynamic";

type ItemPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ItemPage({ params }: ItemPageProps) {
  const { id } = await params;
  const { item, sources, archivedSources, history, bestHistory } = itemDetails(id);

  if (!item) notFound();

  const currency = text(item.currency);

  return (
    <>
      <PageHeading
        eyebrow="ITEM DETAILS"
        title={text(item.name)}
        description={`Current lowest price: ${money(item.current_price, currency)}`}
        action={
          <Link className={ui.secondaryButton} href="/">
            Back to list
          </Link>
        }
      />

      {item.archived_at && (
        <form
          action={restoreItemAction}
          className={cx(ui.note, ui.infoNote, "flex flex-wrap items-center justify-between gap-3")}
        >
          <span>This item is archived.</span>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className={ui.button}>
            Restore item (tracking remains off)
          </button>
        </form>
      )}

      <div className={ui.twoColumns}>
        <section className={ui.panel}>
          <h2 className={ui.sectionTitle}>Item Settings</h2>

          <form className={ui.compactForm} action={saveItemAction}>
            <input type="hidden" name="id" value={id} />
            <label className={ui.label}>
              Name
              <input
                className={ui.field}
                name="name"
                defaultValue={text(item.name)}
                maxLength={500}
                required
              />
            </label>

            <label className={ui.label}>
              Currency
              <input
                className={ui.field}
                name="currency"
                defaultValue={currency}
                maxLength={3}
                required
              />
            </label>

            <div className={ui.twoColumns}>
              <label className={ui.label}>
                Comparison Quantity
                <input
                  className={ui.field}
                  name="comparison_quantity"
                  type="number"
                  min="0.0001"
                  step="any"
                  defaultValue={text(item.comparison_quantity)}
                  required
                />
              </label>
              <label className={ui.label}>
                Unit
                <input
                  className={ui.field}
                  name="unit"
                  defaultValue={text(item.unit)}
                />
              </label>
            </div>

            <label className={ui.label}>
              Target Price
              <input
                className={ui.field}
                name="target_price"
                type="number"
                min="0"
                step="any"
                defaultValue={text(item.target_price)}
              />
            </label>
            <label className={ui.checkboxLabel}>
              <input
                className={ui.checkbox}
                name="tracking_enabled"
                type="checkbox"
                defaultChecked={Boolean(item.tracking_enabled)}
              />
              Enable Tracking
            </label>

            <button className={ui.button} type="submit">
              Save Changes
            </button>
          </form>

          {!item.archived_at && (
            <form
              action={archiveItemAction}
              className="mt-5 border-t border-line pt-4"
            >
              <input type="hidden" name="id" value={id} />
              <button className={ui.dangerButton} type="submit">
                Archive Item
              </button>
            </form>
          )}
        </section>

        <section className={ui.panel}>
          <h2 className={ui.sectionTitle}>Add Source</h2>

          <form className={ui.compactForm} action={addSourceAction}>
            <input type="hidden" name="item_id" value={id} />
            <label className={ui.label}>
              Store Name
              <input
                className={ui.field}
                name="store"
                required
                placeholder="Apotea"
              />
            </label>
            <label className={ui.label}>
              Product URL
              <input
                className={ui.field}
                name="url"
                type="url"
                placeholder="https://..."
              />
            </label>
            <label className={ui.label}>
              Package Quantity
              <input
                className={ui.field}
                name="default_quantity"
                type="number"
                min="0.0001"
                step="any"
                defaultValue="1"
                required
              />
            </label>
            <label className={ui.label}>
              Notes
              <input className={ui.field} name="note" />
            </label>
            <label className={ui.checkboxLabel}>
              <input
                className={ui.checkbox}
                name="scraping_enabled"
                type="checkbox"
                defaultChecked
              />
              Automatic Scraping (requires URL)
            </label>
            <button className={ui.button} type="submit">
              Add Source
            </button>
          </form>
        </section>
      </div>

      <section className={ui.panel}>
        <h2 className={ui.sectionTitle}>Sources and Manual Price Entries</h2>

        {sources.length > 0 ? (
          <div>
            {sources.map((source) => (
              <div
                className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 py-4 first:border-0"
                key={text(source.id)}
              >
                <div className="min-w-[200px] flex-1">
                  <strong>{source.store}</strong>
                  <p className={ui.small}>
                    {source.url ? (
                      <a
                        href={text(source.url)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand hover:underline"
                      >
                        Open Product Page
                      </a>
                    ) : (
                      "Manual Source"
                    )}{" "}
                    · {source.scraping_enabled ? "Automatic Scraping" : "Manual"}
                  </p>
                  <p className={ui.small}>
                    Latest: {money(source.last_price, currency)} ·{" "}
                    {time(source.price_at)}
                  </p>
                </div>

                <form
                  action={addPriceAction}
                  className="flex flex-wrap items-center gap-2"
                >
                  <input type="hidden" name="item_id" value={id} />
                  <input
                    type="hidden"
                    name="source_id"
                    value={text(source.id)}
                  />
                  <input
                    className={cx(ui.field, "w-28!")}
                    name="price"
                    type="number"
                    min="0"
                    step="any"
                    required
                    placeholder="Price"
                    aria-label="Price"
                  />
                  <input
                    className={cx(ui.field, "w-28!")}
                    name="quantity"
                    type="number"
                    min="0.0001"
                    step="any"
                    defaultValue={text(source.default_quantity)}
                    required
                    aria-label="Quantity"
                  />
                  <button className={ui.button} type="submit">
                    Record Price
                  </button>
                </form>

                <div className="flex flex-wrap items-center gap-2">
                  {source.url && (
                    <form action={setSourceScrapingAction}>
                      <input type="hidden" name="item_id" value={id} />
                      <input
                        type="hidden"
                        name="source_id"
                        value={text(source.id)}
                      />
                      <input
                        type="hidden"
                        name="enabled"
                        value={source.scraping_enabled ? "0" : "1"}
                      />
                      <button className={ui.secondaryButton} type="submit">
                        {source.scraping_enabled ? "Disable Scraping" : "Enable Scraping"}
                      </button>
                    </form>
                  )}

                  <form action={archiveSourceAction}>
                    <input type="hidden" name="item_id" value={id} />
                    <input
                      type="hidden"
                      name="source_id"
                      value={text(source.id)}
                    />
                    <button className={ui.dangerButton} type="submit">
                      Archive Source
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className={ui.muted}>
            No sources yet. Add a source above before recording prices.
          </p>
        )}
      </section>

      {archivedSources.length > 0 && (
        <section className={ui.panel}>
          <h2 className={ui.sectionTitle}>Archived Sources</h2>
          <p className={cx(ui.muted, "mb-3")}>
            Restored sources keep automatic scraping off until you enable it separately.
          </p>

          {archivedSources.map((source) => (
            <div
              className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 py-4 first:border-0"
              key={text(source.id)}
            >
              <div className="min-w-[200px] flex-1">
                <strong>{source.store}</strong>
                <p className={ui.small}>
                  Archived: {time(source.archived_at)}
                </p>
                {source.url && (
                  <a
                    href={text(source.url)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-brand hover:underline"
                  >
                    Open Product Page
                  </a>
                )}
              </div>

              <form action={restoreSourceAction}>
                <input type="hidden" name="item_id" value={id} />
                <input
                  type="hidden"
                  name="source_id"
                  value={text(source.id)}
                />
                <button className={ui.secondaryButton} type="submit">
                  Restore Source
                </button>
              </form>
            </div>
          ))}
        </section>
      )}

      <section className={ui.panel}>
        <h2 className={ui.sectionTitle}>Lowest Price History</h2>
        <PriceChart
          points={bestHistory}
          target={item.target_unit_price}
          currency={currency}
        />
      </section>

      <section className={ui.panel}>
        <h2 className={ui.sectionTitle}>Recent Price History</h2>
        <p className={cx(ui.small, "mb-3")}>
          Suspicious prices are recorded automatically and can trigger a target-price
          notification. Excluding one keeps an audit record, but removes it from
          the current lowest-price calculation and valid-price chart.
          Manual price entries remain optional.
        </p>
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th className={ui.th}>Time</th>
                <th className={ui.th}>Store</th>
                <th className={ui.th}>Price</th>
                <th className={ui.th}>Quantity</th>
                <th className={ui.th}>Unit Price</th>
                <th className={ui.th}>Method</th>
                <th className={ui.th}>Status</th>
                <th className={ui.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {history.map((price) => {
                const excluded = Boolean(price.excluded);
                const suspicious = price.result_status === "Suspicious";

                return (
                  <tr
                    key={text(price.id)}
                    className={excluded ? "bg-slate-50 text-muted" : undefined}
                  >
                    <td className={ui.td}>{time(price.recorded_at)}</td>
                    <td className={ui.td}>{price.store}</td>
                    <td className={cx(ui.td, excluded && "line-through")}>
                      {money(price.price, currency)}
                    </td>
                    <td className={ui.td}>{price.quantity}</td>
                    <td className={cx(ui.td, excluded && "line-through")}>
                      {money(price.unit_price, currency)}
                    </td>
                    <td className={ui.td}>{price.origin}</td>
                    <td className={ui.td}>
                      {excluded ? (
                        <span
                          className={cx(ui.tag, ui.tagNeutral)}
                          title={`Excluded at ${time(price.excluded_at)}`}
                        >
                          Excluded
                        </span>
                      ) : suspicious ? (
                        <span
                          className={cx(ui.tag, ui.tagWarn)}
                          title={text(price.suspicious_reason)}
                        >
                          Suspicious
                        </span>
                      ) : (
                        <span className={cx(ui.tag, ui.tagGood)}>
                          Normal
                        </span>
                      )}
                    </td>
                    <td className={ui.td}>
                      {suspicious && !excluded && (
                        <form action={excludeSuspiciousPriceAction}>
                          <input type="hidden" name="item_id" value={id} />
                          <input
                            type="hidden"
                            name="price_id"
                            value={text(price.id)}
                          />
                          <button
                            className={ui.dangerButton}
                            type="submit"
                            title="Soft-delete this suspicious price; the record remains for audit."
                          >
                            Delete
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {history.length === 0 && (
          <p className={cx(ui.muted, "mt-3")}>No price history yet.</p>
        )}
      </section>
    </>
  );
}
