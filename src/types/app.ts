/**
 * File: types/app.ts
 * Purpose:
 *   Defines top-level PriceWatch navigation views.
 *
 * Main type:
 *   - AppView: valid application-level tabs/screens.
 *
 * Inputs:
 *   Navigation state from App and AppHeader.
 *
 * Outputs:
 *   Compile-time union used to route the frontend between products,
 *   subscriptions, scraper, AI, automation and email settings.
 */

export type AppView =
  | "dashboard"
  | "subscriptions"
  | "scraper"
  | "ai"
  | "automation"
  | "email";
