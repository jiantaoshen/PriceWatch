# PriceWatch Local

PriceWatch is a local price-tracking app. It monitors product prices, shows price history, and displays Windows desktop alerts when a new best price meets your target. The website and scraper share one SQLite database, so the scraper can run even when the website is closed.

## Tech Stack

| Part | Technology |
| --- | --- |
| Web app | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS 4, with shared utility groups and readable multiline TSX |
| Database | SQLite (Node.js built-in `node:sqlite` and Python `sqlite3`) |
| Scraper | Python, Playwright, Firefox |
| Notifications | Windows Shell (built-in), no SMTP or new Python dependency |
| Scheduling | Windows Task Scheduler, PowerShell |

No cloud database, account login, .NET API, or separate web server is required.

The frontend now uses **Tailwind CSS 4**. The old `app/classic-*.css` files were removed. See [STYLE_GUIDE.md](STYLE_GUIDE.md) for the file layout, utility conventions, and examples.

## Getting Started

**Requirements:** Windows, Node.js 22.13 or later, Python 3, and the existing `pricewatch.sqlite3` database.

1. Extract the project into a new folder. Copy your latest SQLite database to `data/pricewatch.sqlite3`. Stop other programs writing to the database before copying it.
2. Open PowerShell in the project folder and install dependencies:

   ```powershell
   npm install
   python -m pip install -r scraper/requirements.txt
   python -m playwright install firefox
   ```

   `npm install` also generates `package-lock.json` the first time; no pre-existing lockfile is shipped because it could not be regenerated against npm from the offline build environment.

3. Check the database and start the website:

   ```powershell
   npm run check:db
   npm run dev
   ```

4. Open **http://127.0.0.1:3000**.

To run the full test and build checks on Windows, use:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-all.ps1
```

## Using PriceWatch

Use the tabs at the top of the website:

- **Products:** View, add, edit, and track products and their prices. In each item, restore archived sources, optionally enter manual prices, or exclude a suspicious record without erasing its audit trail.
- **Subscriptions:** Manage the products you follow.
- **Scrape runs:** Check recent scraping results and errors.
- **Notifications:** Test Windows desktop notifications and view the existing below-target alert history.
- **Schedule:** Install or update a daily/weekly Windows task and change its time, choose weekdays, run now, stop a running task, enable/disable the schedule, or delete the task. All from the website.


### Source restoration and suspicious prices (current behavior)

- In a product detail page, **Archive Source** hides the source and disables scraping, but never deletes its historical prices. **Archived Sources → Restore Source** makes it active again with scraping **off**; select **Enable Scraping** on its source row when you want scheduled scans to resume.
- A successfully parsed price that changes more than **80%** from that source's latest non-excluded price is marked **Suspicious** in **Recent Price History**, but is **saved immediately**, considered for the current lowest price, and eligible for the usual one-time target-price notification. An invalid/nonpositive price or a scraping failure is still rejected from price history and logged under **Scrape runs**. There is no Reviews approval page.
- **Delete** on a Suspicious row is a **soft deletion**. The row stays in `price_history` for audit; `scrape_results.review_status='Rejected'` and `reviewed_at` mark its exclusion (reusing the legacy rejected status for maximum database compatibility). It no longer counts as the active source price, the current lowest price is recalculated, and invalid snapshots are filtered from the lowest-price chart. Existing notification events are never removed or retracted, and this action never sends a notification.
- The existing database schema is unchanged, including prior pending/rejected reviews, which remain as historical scrape results. Older pending suspicious observations are **not retroactively approved**; the new rule applies to future scans.
- Manual price entry remains optional and does not send Windows notifications. There is no need to explain a failed scan or submit a replacement price.
- Back up `pricewatch.sqlite3` before switching releases. Stop both the Next.js app and scraper before copying the file.

### Run the Scraper Manually

```powershell
python scraper/run_once.py
```

The scraper reads and writes the same SQLite database. The website does not need to be running.

### Set Up Automatic Scraping (Windows)

1. Start the website as your normal Windows user and open **Schedule**.
2. Choose **Every day** or **Selected weekdays**, choose the local Windows time, then select **Install schedule**.
3. Later, select **Save schedule** to change it. **Run now**, **Stop current run**, **Enable/Disable schedule** and **Delete scheduled task** are available from this page.

You no longer need to type any Task Scheduler commands. The scraper keeps running independently of the website once scheduled. The Windows user must be **signed in** under the default task setup. The site must run under the same user as the managed task, and the task is limited to `\PriceWatchLocalScraper`.

For existing command-line workflows, the optional one-time script remains available:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-scheduler.ps1 -At "09:00"
```

If you use `PRICEWATCH_SQLITE_PATH`, set it before starting the website and save the schedule; the selected database path is stored with the task so scheduled runs use the same file. For a custom Python interpreter, set `PRICEWATCH_PYTHON` before starting the website or use the legacy installer with `-PythonPath`.

## Notes

- Data is stored in `data/pricewatch.sqlite3` by default. You can set `PRICEWATCH_SQLITE_PATH` to use another file.
- Back up your SQLite file before upgrading or testing changes.
- The Email/SMTP/DPAPI code has been removed from this application. Any `local_email_settings` table from an older database is **left untouched but never read**; its password may remain in the database and older backups. You may remove it separately after backing up data if desired.
- The website binds to `127.0.0.1` and is intended for local use only. **Do not publish it over a reverse proxy, tunnel or LAN**: product and scheduler controls assume a trusted local user, not a multi-user login system.
- Scheduler API writes validate the `Host` and `Origin`, operate only on a fixed PriceWatch task and invoke a fixed PowerShell script without a command shell or arbitrary command input. Foreign tasks using the same name are not overwritten.
- Price alerts retain the original SQLite `price_alert_events` table and `best_price_state_id` unique constraint. Only newly scraped accepted best prices at or below the target produce notifications, at most once per best-price state. **Suspicious but valid prices are also accepted and can trigger the same Windows notification.** Previous Sent/Failed events are not resent and old prices are not backfilled. Manual price entries, source restoration and deletion/exclusion actions do not trigger notifications.
- Each scan with new eligible events submits **one summary Windows notification**, showing the first three items and a count of others. All alert events are listed in the **Notifications** tab. Notifications use the built-in Windows Forms `NotifyIcon`/Shell banner API (Windows 10 banner, Windows 11 may be transient); no SMTP, Windows App SDK, pywin32 or third-party PowerShell module is needed.
- Your Windows user must be signed in to an interactive desktop when the scheduled scraper runs. Windows Do Not Disturb/Focus Assist or per-app notification settings can suppress the banner; a successful call means submitted to Windows, **not guaranteed viewed**. Failed submissions are marked Failed and, as with the original mail behavior, are not automatically retried. Test with the **Send test notification** button before relying on alerts.
- Playwright now routes HTTP(S) requests through manual redirects (**every hop checked**), rejects non-public/localhost/private DNS answers and nonstandard ports, blocks Service Workers and **all WebSockets**, blocks automatic downloads/images/media/fonts, limits redirects and page-request count, and uses a fresh Firefox context per product source. Some unusual websites (especially pages requiring WebSockets, image-based pricing, or exact redirect URLs) may not scrape correctly. Check Scrape runs for errors after upgrading.
- These guards do **not** guarantee a hard OS network sandbox: a DNS rebinding race between validation and the actual HTTP connection is still possible. Prefer trusted public stores; for scraping hostile sites, add OS-level outbound firewall restrictions or a secure proxy.
- Schedule management requires Windows. Windows operations were not executable in the Linux verification environment; run `scripts/verify-all.ps1` and test creating a schedule on your Windows PC.
- See [DESIGN.md](DESIGN.md) for architecture and implementation details.

### Scheduler shows a task ownership mismatch

The Scheduler page checks that the Windows task named `PriceWatchLocalScraper` uses the expected launcher, working folder, signed-in Windows account, and non-elevated interactive logon. After saving a task, the page checks those details **before** showing success. The red notice includes a specific mismatch reason.

If a task created by an older version of PriceWatch shows a mismatch, first restart the local Next.js server after updating the code and click **Refresh** on Schedule. If it still differs, open Windows Task Scheduler (`taskschd.msc`), locate `PriceWatchLocalScraper` in Task Scheduler Library, and verify its action and account. If it is indeed the old PriceWatch task, delete **only that task** from the Windows GUI, then use the Schedule page to install it again. This does not remove SQLite or scrape history. Do not delete an unfamiliar task solely because the name matches.

### Switching from Email to Windows notifications

1. Stop the Next.js server and any running scraper. Back up your existing SQLite database, then replace the source files without replacing `data/pricewatch.sqlite3` or your `.env`.
2. Start `npm run dev`; open **Notifications** and click **Send test notification** while logged into Windows. It does not add an alert event to SQLite.
3. Keep the existing Windows Schedule task; it runs the same `scraper/run_once.py` entry point, now delivering the alert to the signed-in desktop instead of SMTP. Check Windows notification settings if no banner appears.
4. Previously sent email events stay in `price_alert_events` and remain deduplicated; no new alert table or database migration is necessary. Prior `local_email_settings` data remains untouched but is not used.

To test from the Windows terminal:

```powershell
python scraper/windows_alerts.py --test
```

The Windows Shell banner can be transient on Windows 11 and is not a guarantee of notification-center history. PriceWatch's Notifications page is the durable alert history.

### Tailwind refactor notes

- Tailwind 4 styling and readable multiline JSX are retained. This release also changes suspicious-price handling and source restoration as described above, without altering the existing SQLite schema or Windows Task Scheduler.
- `app/globals.css` declares Tailwind v4 and shared theme colors; `lib/ui.ts` contains repeated button, input, table and panel utility classes.
- `components/page-heading.tsx` centralizes recurring page headings. Individual pages keep their Tailwind utilities close to their JSX.
- Since styles are compiled during `npm run dev` / `npm run build`, **install Node dependencies first** (`npm install`); a network connection is required for the first install.
