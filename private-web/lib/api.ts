import {
  ApiError,
  getErrorMessage,
  request,
} from "@pricewatch/api/core";

const CLIENT_HEADER = "X-PriceWatch-Client";

export {
  ApiError,
  getErrorMessage,
};

export async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set(CLIENT_HEADER, "private-web");

  return request<T>({
    baseUrl: "",
    path,
    init: {
      ...init,
      headers,
    },
  });
}
