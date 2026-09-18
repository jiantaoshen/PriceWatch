"use client";

import {
  InteractionRequiredAuthError,
  PublicClientApplication,
} from "@azure/msal-browser";

const clientId =
  process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID ?? "";

const tenant =
  process.env.NEXT_PUBLIC_MICROSOFT_TENANT ?? "consumers";

export const apiScope =
  process.env.NEXT_PUBLIC_API_SCOPE ?? "";

export const redirectUri =
  process.env.NEXT_PUBLIC_MICROSOFT_REDIRECT_URI ??
  "http://localhost:3000/redirect";

export const msalInstance =
  new PublicClientApplication({
    auth: {
      clientId,
      authority:
        `https://login.microsoftonline.com/${tenant}`,
      redirectUri,
    },
    cache: {
      cacheLocation: "sessionStorage",
    },
  });

let initializePromise: Promise<void> | null = null;

export function initializeMsal() {
  if (!initializePromise) {
    initializePromise = msalInstance.initialize();
  }

  return initializePromise;
}

export { InteractionRequiredAuthError };
