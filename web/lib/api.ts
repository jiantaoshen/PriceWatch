import {
  ApiError,
  request,
} from "@pricewatch/api/core";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "";

export { ApiError };

export async function apiFetch<T>(
  path: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  return request<T>({
    baseUrl: apiUrl,
    path,
    accessToken,
    init,
  });
}
