"use client";

import { SubscriptionFormPage } from "@/components/subscription-form-page";
import { useAuth } from "@/components/auth-provider";

export default function NewSubscriptionPage() {
  const { ready, account } = useAuth();

  if (!ready) {
    return null;
  }

  if (!account) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Sign in to add a subscription.
      </div>
    );
  }

  return (
    <SubscriptionFormPage mode="create" />
  );
}