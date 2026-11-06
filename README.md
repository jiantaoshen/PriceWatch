# PriceWatch Local

PriceWatch is a local price-tracking app. It monitors product prices, shows price history, and sends email alerts when a new best price meets your target. The website and scraper share one SQLite database, so the scraper can run even when the website is closed.

Note:
This project was originally deployed on Vercel and other cloud services as a portfolio showcase. However, after using it for about a month, I realized that I rarely needed to access it online, and I barely used many of its features. Therefore, I decided to run it locally instead of hosting it in the cloud.

Rather than showcasing a project with features I rarely use, I decided to rebuild it with a simpler design and a clearer focus on demonstrating my system design skills.

I also decided not to use shadcn/ui this time because I encountered security vulnerabilities involving dependencies such as `glob` and `minimatch` during development. Rather than continuing with the same dependency setup, I used AI to help recreate a similar design using plain CSS.

## Tech Stack

| Part | Technology |
| --- | --- |
| Web app | Next.js 16, React 19, TypeScript |
| Styling | Plain CSS, based on the original PriceWatch design |
| Database | SQLite (Node.js built-in `node:sqlite` and Python `sqlite3`) |
| Scraper | Python, Playwright, Firefox |
| Email alerts | SMTP |
| Scheduling | Windows Task Scheduler, PowerShell |

No cloud database, account login, .NET API, or separate web server is required.

## Getting Started

**Requirements:** Windows, Node.js 22.13 or later, Python 3, and the existing `pricewatch.sqlite3` database.

1. Extract the project into a new folder. Copy your latest SQLite database to `data/pricewatch.sqlite3`. Stop other programs writing to the database before copying it.
2. Open PowerShell in the project folder and install dependencies:

   ```powershell
   npm install
   python -m pip install -r scraper/requirements.txt
   python -m playwright install firefox
   ```

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

- **Products:** View, add, edit, and track products and their prices.
- **Subscriptions:** Manage the products you follow.
- **Reviews:** Approve or reject suspicious scraped prices.
- **Scrape runs:** Check recent scraping results and errors.
- **Email alerts:** Configure SMTP, send a test email, and review alerts.
- **Schedule:** Install or update a daily/weekly Windows task and change its time, choose weekdays, run now, stop a running task, enable/disable the schedule, or delete the task. All from the website.

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
- SMTP app passwords are stored as **Windows user-scoped DPAPI ciphertext** (`dpapi:v1:`) in SQLite. The Email page migrates an older plaintext password automatically when opened; a scheduled crawl also migrates it before delivery. Always back up the original database before upgrading. Previously exported backups or database snapshots may still contain the old plaintext; protect or replace them.
- **Important:** Open the website and run Windows Task Scheduler using the **same Windows account**, with that user's profile available. If you change Windows accounts or reinstall Windows, encrypted SMTP passwords might not decrypt; enter the SMTP app password again in Email settings. Don't run the scraper as SYSTEM. Encryption on disk does not protect against malware already running as the same Windows user.
- The website binds to `127.0.0.1` and is intended for local use only. **Do not publish it over a reverse proxy, tunnel or LAN**: product, email and scheduler controls assume a trusted local user, not a multi-user login system.
- Scheduler API writes validate the `Host` and `Origin`, operate only on a fixed PriceWatch task and invoke a fixed PowerShell script without a command shell or arbitrary command input. Foreign tasks using the same name are not overwritten.
- SMTP TLS now uses verified certificates. SMTP servers with self-signed/untrusted certificates must be configured with a trusted certificate rather than ignoring TLS errors.
- Playwright now routes HTTP(S) requests through manual redirects (**every hop checked**), rejects non-public/localhost/private DNS answers and nonstandard ports, blocks Service Workers and **all WebSockets**, blocks automatic downloads/images/media/fonts, limits redirects and page-request count, and uses a fresh Firefox context per product source. Some unusual websites (especially pages requiring WebSockets, image-based pricing, or exact redirect URLs) may not scrape correctly. Check Scrape runs for errors after upgrading.
- These guards do **not** guarantee a hard OS network sandbox: a DNS rebinding race between validation and the actual HTTP connection is still possible. Prefer trusted public stores; for scraping hostile sites, add OS-level outbound firewall restrictions or a secure proxy.
- Schedule management requires Windows. Windows operations were not executable in the Linux verification environment; run `scripts/verify-all.ps1` and test creating a schedule on your Windows PC.
- See [DESIGN.md](DESIGN.md) for architecture and implementation details.
