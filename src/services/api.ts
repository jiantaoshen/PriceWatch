interface ApiErrorResponse {
  error?: string;
}

export async function apiJson<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, options);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(getErrorMessage(text, response.status));
  }

  if (!text.trim()) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  }
  catch {
    throw new Error(
      `Server returned invalid JSON (${response.status}).`,
    );
  }
}

export function jsonRequest(
  method: "POST" | "PUT" | "PATCH",
  body: unknown,
): RequestInit {
  return {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

function getErrorMessage(text: string, status: number): string {
  if (!text.trim()) {
    return `Request failed (${status}).`;
  }

  try {
    const data = JSON.parse(text) as ApiErrorResponse;

    if (data.error) {
      return data.error;
    }
  }
  catch {
    // Response is not JSON.
  }

  return text;
}

export async function apiJsonOr<T>(
  url: string,
  fallback: T,
  status = 404,
): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });

  if (response.status === status) return fallback;

  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || `Request failed (${response.status}).`);
  }

  return JSON.parse(text) as T;
}
