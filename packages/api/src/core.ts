export class ApiError extends Error {
  status: number;

  constructor(
    status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getErrorMessage(
  error: unknown
) {
  return error instanceof Error
    ? error.message
    : String(error);
}

export async function request<T>({
  baseUrl,
  path,
  accessToken,
  init,
}: {
  baseUrl: string;
  path: string;
  accessToken?: string;
  init?: RequestInit;
}): Promise<T> {
  const headers =
    new Headers(init?.headers);

  if (accessToken) {
    headers.set(
      "Authorization",
      `Bearer ${accessToken}`
    );
  }

  if (
    init?.body &&
    !headers.has("Content-Type")
  ) {
    headers.set(
      "Content-Type",
      "application/json"
    );
  }

  const response =
    await fetch(
      `${baseUrl}${path}`,
      {
        ...init,
        headers,
        cache: "no-store",
      }
    );

  if (!response.ok) {
    const fallback =
      `${response.status} ${response.statusText}`;

    // Never surface raw 5xx response bodies. A backend failure can contain
    // provider exceptions, stack traces, connection strings, or credentials.
    if (response.status >= 500) {
      let traceId: string | undefined;

      try {
        const problem =
          (await response.json()) as {
            traceId?: unknown;
          };

        if (typeof problem.traceId === "string") {
          traceId = problem.traceId;
        }
      } catch {
        // Intentionally ignore malformed/non-JSON error bodies.
      }

      throw new ApiError(
        response.status,
        traceId
          ? `Internal server error (${traceId})`
          : "Internal server error"
      );
    }

    let message = fallback;

    try {
      const problem =
        (await response.json()) as {
          detail?: unknown;
          title?: unknown;
          error?: unknown;
        };

      if (typeof problem.detail === "string") {
        message = problem.detail;
      } else if (typeof problem.error === "string") {
        message = problem.error;
      } else if (typeof problem.title === "string") {
        message = problem.title;
      }
    } catch {
      // Non-5xx responses may still be plain text. Keep the generic status
      // rather than echoing an arbitrary response body into the UI.
    }

    throw new ApiError(
      response.status,
      message
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text =
    await response.text();

  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}
