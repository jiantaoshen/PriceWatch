const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "";

export class ApiError extends Error {
  status: number;

  constructor(
    status: number,
    message: string
  ) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(
  path: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(
    `${apiUrl}${path}`,
    {
      ...init,
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
        ...(init?.body
          ? {
              "Content-Type":
                "application/json",
            }
          : {}),
        ...init?.headers,
      },
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
