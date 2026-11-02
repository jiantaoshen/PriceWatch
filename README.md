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
- **Schedule:** View the Windows task and click **Run now** to start scraping.

### Run the Scraper Manually

```powershell
python scraper/run_once.py
```

The scraper reads and writes the same SQLite database. The website does not need to be running.

### Set Up Automatic Scraping (Windows)

Run this once from PowerShell in the project folder to schedule a daily scrape at 09:00:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-scheduler.ps1 -At "09:00"
```

You can change the time by changing `-At`. Open the **Schedule** tab to see task status and use **Run now**. The default scheduled task requires the Windows user to remain signed in; the website may be closed.

## Notes

- Data is stored in `data/pricewatch.sqlite3` by default. You can set `PRICEWATCH_SQLITE_PATH` to use another file.
- Back up your SQLite file before upgrading or testing changes.
- SMTP credentials are stored in the local SQLite database in plain text. Protect the database and its backups; use an app-specific email password.
- The website is intended for local use only. Do not expose its Scheduler API to the internet or a LAN.
- See [DESIGN.md](DESIGN.md) for architecture and implementation details.
