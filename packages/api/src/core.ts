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
    const text =
      await response.text();

    throw new ApiError(
      response.status,
      text ||
        `${response.status} ${response.statusText}`
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
