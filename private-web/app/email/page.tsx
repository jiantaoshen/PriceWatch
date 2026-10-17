"use client";

import { MailCheck, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@pricewatch/ui/alert";
import { Button } from "@pricewatch/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pricewatch/ui/card";
import { Input } from "@pricewatch/ui/input";
import { Label } from "@pricewatch/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Page } from "@/components/page";
import { apiFetch, getErrorMessage } from "@/lib/api";

type EmailSettings = {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  useSsl: boolean;
  timeoutSeconds: number;
  username: string;
  passwordConfigured: boolean;
  from: string;
  to: string;
};

type Message = {
  text: string;
  variant: "success" | "destructive";
};

const initialSettings: EmailSettings = {
  enabled: false,
  smtpHost: "",
  smtpPort: 587,
  useSsl: true,
  timeoutSeconds: 30,
  username: "",
  passwordConfigured: false,
  from: "",
  to: "",
};

export default function EmailPage() {
  const [settings, setSettings] = useState<EmailSettings>(initialSettings);
  const [password, setPassword] = useState("");
  const [clearPassword, setClearPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiFetch<EmailSettings>("/api/private/email-settings")
      .then((result) => {
        if (cancelled) return;
        setSettings(result);
        setLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        setMessage({ text: getErrorMessage(error), variant: "destructive" });
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function update<K extends keyof EmailSettings>(key: K, value: EmailSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setBusy(true);
    setMessage(null);

    try {
      const result = await apiFetch<EmailSettings>("/api/private/email-settings", {
        method: "PUT",
        body: JSON.stringify({
          enabled: settings.enabled,
          smtpHost: settings.smtpHost,
          smtpPort: settings.smtpPort,
          useSsl: settings.useSsl,
          timeoutSeconds: settings.timeoutSeconds,
          username: settings.username,
          password: password || null,
          clearPassword,
          from: settings.from,
          to: settings.to,
        }),
      });

      setSettings(result);
      setPassword("");
      setClearPassword(false);
      setMessage({ text: "Email settings saved.", variant: "success" });
    } catch (error) {
      setMessage({ text: getErrorMessage(error), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setMessage(null);

    try {
      await apiFetch<{ status: string }>("/api/private/email-settings/test", {
        method: "POST",
      });
      setMessage({ text: "Test email sent.", variant: "success" });
    } catch (error) {
      setMessage({ text: getErrorMessage(error), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page
      title="Email"
      description="Configure local SMTP delivery for automatic below-target price alerts."
    >
      <Card className="max-w-3xl gap-0 py-0">
        <CardHeader className="border-b p-5">
          <CardTitle>Price alert email</CardTitle>
          <CardDescription>
            Credentials stay in the local Private backend. The saved password is never returned to the browser.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5 p-5">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading email settings…</p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="email-enabled"
                  checked={settings.enabled}
                  onCheckedChange={(checked) => update("enabled", checked === true)}
                />
                <Label htmlFor="email-enabled" className="font-normal">
                  Enable automatic price alert emails
                </Label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="smtp-host">SMTP host</Label>
                  <Input
                    id="smtp-host"
                    value={settings.smtpHost}
                    placeholder="smtp.gmail.com"
                    onChange={(event) => update("smtpHost", event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smtp-port">Port</Label>
                  <Input
                    id="smtp-port"
                    type="number"
                    min={1}
                    max={65535}
                    value={settings.smtpPort}
                    onChange={(event) => update("smtpPort", Number(event.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smtp-timeout">Timeout (seconds)</Label>
                  <Input
                    id="smtp-timeout"
                    type="number"
                    min={1}
                    max={300}
                    value={settings.timeoutSeconds}
                    onChange={(event) => update("timeoutSeconds", Number(event.target.value))}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="smtp-ssl"
                  checked={settings.useSsl}
                  onCheckedChange={(checked) => update("useSsl", checked === true)}
                />
                <Label htmlFor="smtp-ssl" className="font-normal">
                  Use TLS / SSL
                </Label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="smtp-username">Username</Label>
                  <Input
                    id="smtp-username"
                    autoComplete="username"
                    value={settings.username}
                    placeholder="you@example.com"
                    onChange={(event) => update("username", event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smtp-password">Password / app password</Label>
                  <Input
                    id="smtp-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    disabled={clearPassword}
                    placeholder={
                      settings.passwordConfigured
                        ? "Leave blank to keep saved password"
                        : "Enter SMTP password"
                    }
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
              </div>

              {settings.passwordConfigured && (
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="clear-email-password"
                    checked={clearPassword}
                    onCheckedChange={(checked) => setClearPassword(checked === true)}
                  />
                  <Label htmlFor="clear-email-password" className="font-normal">
                    Clear the saved SMTP password when I save
                  </Label>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email-from">From</Label>
                  <Input
                    id="email-from"
                    type="email"
                    value={settings.from}
                    placeholder="you@example.com"
                    onChange={(event) => update("from", event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email-to">To</Label>
                  <Input
                    id="email-to"
                    value={settings.to}
                    placeholder="you@example.com"
                    onChange={(event) => update("to", event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Multiple recipients can be separated with commas or semicolons.
                  </p>
                </div>
              </div>

              {message && (
                <Alert variant={message.variant}>
                  <AlertDescription>{message.text}</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-wrap gap-2">
                <Button onClick={save} disabled={busy}>
                  <Save />
                  Save settings
                </Button>
                <Button variant="outline" onClick={sendTest} disabled={busy || !settings.enabled}>
                  <MailCheck />
                  Send test email
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </Page>
  );
}
