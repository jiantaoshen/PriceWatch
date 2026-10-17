"use client";

import { Button } from "@pricewatch/ui/button";
import { useAuth } from "@/components/auth-provider";

export function AuthButton() {
  const {
    ready,
    account,
    signIn,
    signOut,
  } = useAuth();

  if (!ready) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
      >
        Loading…
      </Button>
    );
  }

  if (!account) {
    return (
      <Button
        size="sm"
        onClick={() => {
          signIn().catch(console.error);
        }}
      >
        Login
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        signOut().catch(console.error);
      }}
    >
      Logout
    </Button>
  );
}
