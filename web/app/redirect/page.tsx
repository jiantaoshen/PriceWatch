"use client";

import { useEffect } from "react";
import {
  broadcastResponseToMainFrame,
} from "@azure/msal-browser/redirect-bridge";

export default function RedirectPage() {
  useEffect(() => {
    broadcastResponseToMainFrame()
      .catch((error) => {
        console.error(
          "MSAL redirect bridge error:",
          error
        );
      });
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center p-8 text-sm text-muted-foreground">
      Processing Microsoft authentication…
    </main>
  );
}
