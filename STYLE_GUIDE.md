# PriceWatch Tailwind & Readability Guide

PriceWatch uses **Tailwind CSS v4** with a few reusable utility strings; no
legacy `.classic-*` stylesheet remains.

## Where things live

| File | Responsibility |
| --- | --- |
| `app/globals.css` | Tailwind import, source scanning, theme colors, font and body defaults |
| `lib/ui.ts` | Shared Tailwind classes for buttons, fields, panels, tables and status badges |
| `components/page-heading.tsx` | Shared page title, description, and optional action |
| `components/product-card.tsx` | Product card presentation |
| `components/product-list.tsx` | Product filters, sorting and card listing |
| `components/scheduler-control.tsx` | Client-side Windows task UI, status fetch and actions |
| `app/**/page.tsx` | Readable multiline page JSX and forms |

## How to change a style

1. **Global color or font**: change the relevant `@theme` variable in
   `app/globals.css`, e.g. `--color-brand`.
2. **Repeated component look**: edit the utility group in `lib/ui.ts`.
3. **One page only**: add local Tailwind utilities near that JSX element.

For example:

```tsx
import { ui } from "../../lib/ui";

export default function Example() {
  return (
    <section className={ui.panel}>
      <h2 className={ui.sectionTitle}>Example</h2>
      <button className={ui.button} type="button">
        Save
      </button>
    </section>
  );
}
```

`cx()` in `lib/ui.ts` combines conditional class strings. Keep variant classes
literal so Tailwind can discover them at build time.

## Formatting conventions

- Use **two spaces** for indentation in TS, TSX, CSS, and JSON.
- Put JSX elements, props, and conditional branches on separate lines.
- Name important intermediate values (e.g. `belowTarget`, `scheduleLocked`).
- Keep SQL inside template literals; SQL structure was not changed.
- Avoid adding dependencies or modifying Python/PowerShell business logic for
  cosmetic frontend changes.

## Running on Windows

```powershell
npm install
npm run typecheck
npm run build
npm run dev
```

Tailwind v4 uses `postcss.config.mjs`; no `tailwind.config.js` file is needed.
The first `npm install` creates a new `package-lock.json` locally. Keep that
lockfile when committing the project once dependencies are installed.
