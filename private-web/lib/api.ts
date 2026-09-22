import {
  ApiError,
  getErrorMessage,
  request,
} from "@pricewatch/api/core";

const apiUrl =
  process.env.NEXT_PUBLIC_PRIVATE_API_URL ??
  "http://127.0.0.1:5188";

export {
  ApiError,
  getErrorMessage,
};

export async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  return request<T>({
    baseUrl: apiUrl,
    path,
    init,
  });
}
