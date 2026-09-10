/**
 * File: services/scraperApi.ts
 * Purpose:
 *   Starts the Python price checker, reads its process state, and optionally
 *   waits until a manually corrected price has been re-evaluated.
 *
 * Main functions:
 *   - fetchScraperStatus(): return whether the scraper process is running.
 *   - runScraper(): start a new scraper process.
 *   - waitForScraperCompletion(): poll until the current process has finished.
 *
 * Inputs:
 *   No product data; requests are sent to the ASP.NET scraper endpoints.
 *
 * Outputs:
 *   ScraperStatus or Promise<void> when start/wait operations complete.
 */

export const API_BASE_URL = "";

export interface ScraperStatus {
  running: boolean;
  process_id: number | null;
}


export async function fetchScraperStatus(): Promise<ScraperStatus> {
  const response = await fetch(
    `${API_BASE_URL}/api/scraper/status`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error(`Failed to load scraper status: ${response.status}`);
  }

  return response.json();
}


export async function runScraper(): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/scraper/run`,
    { method: "POST" },
  );

  if (response.status === 409) {
    throw new Error("Price checker is already running.");
  }

  if (!response.ok) {
    throw new Error(`Failed to start price checker: ${response.status}`);
  }
}


export async function waitForScraperCompletion(
  pollMilliseconds = 1500,
): Promise<void> {
  // Give the spawned process a moment to enter the running state before polling.
  await sleep(500);

  while (true) {
    const status = await fetchScraperStatus();

    if (!status.running) {
      return;
    }

    await sleep(pollMilliseconds);
  }
}


function sleep(milliseconds: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, milliseconds));
}
