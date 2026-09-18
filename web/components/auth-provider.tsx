"use client";

import {
  AccountInfo,
  AuthenticationResult,
} from "@azure/msal-browser";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  apiScope,
  initializeMsal,
  InteractionRequiredAuthError,
  msalInstance,
  redirectUri,
} from "@/lib/msal";

type AuthContextValue = {
  ready: boolean;
  account: AccountInfo | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  getAccessToken:
    () => Promise<AuthenticationResult>;
};

const AuthContext =
  createContext<AuthContextValue | null>(
    null
  );

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] =
    useState(false);

  const [account, setAccount] =
    useState<AccountInfo | null>(null);

  useEffect(() => {
    let mounted = true;

    async function start() {
      await initializeMsal();

      if (!mounted) {
        return;
      }

      const existing =
        msalInstance.getAllAccounts()[0] ??
        null;

      if (existing) {
        msalInstance.setActiveAccount(
          existing
        );
      }

      setAccount(existing);
      setReady(true);
    }

    start().catch((error) => {
      console.error(
        "MSAL initialization failed:",
        error
      );

      if (mounted) {
        setReady(true);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const signIn =
    useCallback(async () => {
      await initializeMsal();

      const result =
        await msalInstance.loginPopup({
          scopes: [apiScope],
          prompt: "select_account",
          redirectUri,
        });

      msalInstance.setActiveAccount(
        result.account
      );

      setAccount(result.account);
    }, []);

  const signOut =
    useCallback(async () => {
      await initializeMsal();

      const current =
        msalInstance.getActiveAccount() ??
        account ??
        undefined;

      await msalInstance.logoutPopup({
        account: current,
        postLogoutRedirectUri:
          window.location.origin,
      });

      msalInstance.setActiveAccount(null);
      setAccount(null);
    }, [account]);

  const getAccessToken =
    useCallback(async () => {
      await initializeMsal();

      const current =
        msalInstance.getActiveAccount() ??
        account ??
        msalInstance.getAllAccounts()[0];

      if (!current) {
        throw new Error(
          "No Microsoft account is signed in."
        );
      }

      try {
        return await msalInstance.acquireTokenSilent({
          account: current,
          scopes: [apiScope],
          redirectUri,
        });
      } catch (error) {
        if (
          error instanceof
          InteractionRequiredAuthError
        ) {
          return await msalInstance.acquireTokenPopup({
            account: current,
            scopes: [apiScope],
            redirectUri,
          });
        }

        throw error;
      }
    }, [account]);

  const value =
    useMemo<AuthContextValue>(
      () => ({
        ready,
        account,
        signIn,
        signOut,
        getAccessToken,
      }),
      [
        ready,
        account,
        signIn,
        signOut,
        getAccessToken,
      ]
    );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider."
    );
  }

  return context;
}
