import Link from "next/link";
import { PageHeading } from "../../../components/page-heading";
import { ui } from "../../../lib/ui";
import { saveItemAction } from "../../actions";

export default function NewItem() {
  return (
    <>
      <PageHeading
        title="Add product"
        description="New items are stored directly in local SQLite."
      />

      <section className={`${ui.panel} max-w-[720px]`}>
        <form className={ui.form} action={saveItemAction}>
          <label className={ui.label}>
            Name
            <input className={ui.field} name="name" maxLength={500} required />
          </label>

          <label className={ui.label}>
            Currency
            <input
              className={ui.field}
              name="currency"
              defaultValue="SEK"
              maxLength={3}
              required
            />
          </label>

          <div className={ui.twoColumns}>
            <label className={ui.label}>
              Comparison quantity
              <input
                className={ui.field}
                name="comparison_quantity"
                type="number"
                min="0.0001"
                step="any"
                defaultValue="1"
                required
              />
            </label>
            <label className={ui.label}>
              Unit
              <input className={ui.field} name="unit" placeholder="kg / L / item" />
            </label>
          </div>

          <label className={ui.label}>
            Target price
            <input className={ui.field} name="target_price" type="number" min="0" step="any" />
          </label>
          <label className={ui.checkboxLabel}>
            <input
              className={ui.checkbox}
              name="tracking_enabled"
              type="checkbox"
              defaultChecked
            />
            Enable tracking
          </label>

          <div className={ui.buttonRow}>
            <button className={ui.button} type="submit">Save item</button>
            <Link className={ui.secondaryButton} href="/">Cancel</Link>
          </div>
        </form>
      </section>
    </>
  );
}
