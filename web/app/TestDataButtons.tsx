"use client";

import { useState } from "react";
import testData from "./test-products.json";

type TokenResult = {
  accessToken: string;
};

type Props = {
  apiUrl: string;
  getAccessToken: () => Promise<TokenResult>;
};

const STORAGE_KEY = "pricewatch_test_item_ids";

export default function TestDataButtons({
  apiUrl,
  getAccessToken,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  function append(message: string) {
    setLog((current) => [...current, message]);
  }

  function readCreatedIds(): string[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveCreatedIds(ids: string[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  }

  async function request(
    path: string,
    method = "GET",
    body?: unknown
  ) {
    const token = await getAccessToken();

    const response = await fetch(`${apiUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        ...(body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body:
        body !== undefined
          ? JSON.stringify(body)
          : undefined,
    });

    const text = await response.text();

    let data: unknown = null;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!response.ok) {
      throw new Error(
        `${method} ${path} -> ${response.status}\n` +
          (typeof data === "string"
            ? data
            : JSON.stringify(data, null, 2))
      );
    }

    return data;
  }

  async function addAll() {
    if (busy) return;

    setBusy(true);
    setLog([]);

    try {
      const existingIds = readCreatedIds();

      if (existingIds.length > 0) {
        throw new Error(
          "Test data already exists in localStorage. " +
            "Use Delete All Test Products first."
        );
      }

      const createdIds: string[] = [];

      for (const entry of testData.items) {
        append(`Adding item: ${entry.name}`);

        const itemRequest = {
          itemType: entry.itemType,
          name: entry.name,
          currency: entry.currency,
          unit: entry.unit,
          targetPrice: entry.targetPrice,
          comparisonQuantity: entry.comparisonQuantity,
          lastPurchasePrice: entry.lastPurchasePrice,
          lastPurchaseDate: entry.lastPurchaseDate,
          updateMode: entry.updateMode,
          checkIntervalMinutes: entry.checkIntervalMinutes,
          trackingEnabled: entry.trackingEnabled,
        };

        const created = (await request(
          "/api/items",
          "POST",
          itemRequest
        )) as { id?: string };

        if (!created.id) {
          throw new Error(
            `Create item returned no id: ${entry.name}`
          );
        }

        createdIds.push(created.id);

        // Save after every item, so cleanup still works
        // if a later request fails.
        saveCreatedIds(createdIds);

        append(`  item id: ${created.id}`);

        for (const source of entry.sources) {
          append(`  adding source: ${source.store}`);

          await request(
            `/api/items/${created.id}/sources`,
            "POST",
            source
          );
        }

        append(`✓ ${entry.name}`);
      }

      append("");
      append(
        `✓ Added ${createdIds.length} test products successfully.`
      );
    } catch (error) {
      append("");
      append(
        `✗ ${
          error instanceof Error
            ? error.message
            : String(error)
        }`
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteAll() {
    if (busy) return;

    const confirmed = window.confirm(
      "Permanently delete all test products created by this browser?"
    );

    if (!confirmed) return;

    setBusy(true);
    setLog([]);

    try {
      const ids = readCreatedIds();

      if (ids.length === 0) {
        append("No saved test item IDs found.");
        return;
      }

      // Delete in reverse creation order.
      for (const id of [...ids].reverse()) {
        append(`Deleting item: ${id}`);

        try {
          await request(
            `/api/items/${id}`,
            "DELETE"
          );

          append(`✓ deleted ${id}`);
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : String(error);

          // A previous manual cleanup may already have deleted it.
          if (message.includes("-> 404")) {
            append(`- ${id} already missing (404), skipping`);
            continue;
          }

          throw error;
        }
      }

      localStorage.removeItem(STORAGE_KEY);

      append("");
      append("✓ All saved test products deleted.");
    } catch (error) {
      append("");
      append(
        `✗ ${
          error instanceof Error
            ? error.message
            : String(error)
        }`
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ marginTop: 32 }}>
      <hr />

      <h2>Legacy Product Test Data</h2>

      <p>
        Adds the converted legacy products and sources to the
        current WebApi. Delete removes only the item IDs created
        by this browser.
      </p>

      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={addAll}
          disabled={busy}
          style={{
            padding: "10px 16px",
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          Add All Test Products
        </button>

        <button
          type="button"
          onClick={deleteAll}
          disabled={busy}
          style={{
            padding: "10px 16px",
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          Delete All Test Products
        </button>
      </div>

      {log.length > 0 && (
        <pre
          style={{
            marginTop: 20,
            background: "#111",
            color: "#eee",
            padding: 20,
            borderRadius: 8,
            whiteSpace: "pre-wrap",
            overflowX: "auto",
          }}
        >
          {log.join("\n")}
        </pre>
      )}
    </section>
  );
}
