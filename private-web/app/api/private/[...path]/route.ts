const CLIENT_HEADER = "X-PriceWatch-Client";
const CLIENT_HEADER_VALUE = "private-web";
const TOKEN_HEADER = "X-PriceWatch-Token";

const MUTATION_METHODS = new Set([
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]);

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

function normalizeOrigin(value: string): string {
  const url = new URL(value);

  return url.origin;
}

function isTrustedBrowserRequest(
  request: Request,
  frontendOrigin: string,
): boolean {
  const expectedFrontend = new URL(frontendOrigin);
  const host = request.headers.get("host");

  // The request must be sent to the configured local frontend.
  if (host !== expectedFrontend.host) {
    return false;
  }

  // Requests from private-web's API client include this marker.
  if (
    request.headers.get(CLIENT_HEADER) !==
    CLIENT_HEADER_VALUE
  ) {
    return false;
  }

  // Read-only requests do not require Origin validation.
  if (!MUTATION_METHODS.has(request.method)) {
    return true;
  }

  // Browser write requests must be same-origin.
  const origin = request.headers.get("origin");

  if (origin) {
    try {
      return normalizeOrigin(origin) === frontendOrigin;
    } catch {
      return false;
    }
  }

  // Fallback for browsers that omit Origin.
  return (
    request.headers.get("sec-fetch-site") ===
    "same-origin"
  );
}

function buildTargetUrl(
  request: Request,
  apiBaseUrl: string,
  path: string[],
): URL {
  const incomingUrl = new URL(request.url);

  const encodedPath = path
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  const targetUrl = new URL(
    `/api/private/${encodedPath}`,
    apiBaseUrl,
  );

  targetUrl.search = incomingUrl.search;

  return targetUrl;
}

function buildProxyHeaders(
  request: Request,
  token: string,
): Headers {
  const headers = new Headers();

  const accept = request.headers.get("accept");
  const contentType = request.headers.get("content-type");

  if (accept) {
    headers.set("accept", accept);
  }

  if (contentType) {
    headers.set("content-type", contentType);
  }

  headers.set(TOKEN_HEADER, token);

  return headers;
}

function buildResponseHeaders(
  response: Response,
): Headers {
  const headers = new Headers();

  const contentType = response.headers.get("content-type");
  const cacheControl = response.headers.get("cache-control");

  if (contentType) {
    headers.set("content-type", contentType);
  }

  if (cacheControl) {
    headers.set("cache-control", cacheControl);
  }

  return headers;
}

async function proxyRequest(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const frontendOrigin = normalizeOrigin(
    getRequiredEnv("PRIVATE_FRONTEND_URL"),
  );

  const apiBaseUrl = normalizeOrigin(
    getRequiredEnv("PRIVATE_API_URL"),
  );

  const token = getRequiredEnv("PRIVATE_API_TOKEN");

  if (!isTrustedBrowserRequest(request, frontendOrigin)) {
    return Response.json(
      {
        error: "Forbidden",
      },
      {
        status: 403,
      },
    );
  }

  const { path } = await context.params;

  if (!path?.length) {
    return Response.json(
      {
        error: "Invalid private API path.",
      },
      {
        status: 400,
      },
    );
  }

  const targetUrl = buildTargetUrl(
    request,
    apiBaseUrl,
    path,
  );

  const headers = buildProxyHeaders(
    request,
    token,
  );

  let body: ArrayBuffer | undefined;

  if (
    request.method !== "GET" &&
    request.method !== "HEAD"
  ) {
    const buffer = await request.arrayBuffer();

    if (buffer.byteLength > 0) {
      body = buffer;
    }
  }

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
    });

    const responseBody =
      await upstreamResponse.arrayBuffer();

    return new Response(responseBody, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: buildResponseHeaders(
        upstreamResponse,
      ),
    });
  } catch {
    return Response.json(
      {
        error: "Private API is unavailable.",
      },
      {
        status: 502,
      },
    );
  }
}

export async function GET(
  request: Request,
  context: RouteContext,
) {
  return proxyRequest(request, context);
}

export async function POST(
  request: Request,
  context: RouteContext,
) {
  return proxyRequest(request, context);
}

export async function PUT(
  request: Request,
  context: RouteContext,
) {
  return proxyRequest(request, context);
}

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  return proxyRequest(request, context);
}

export async function DELETE(
  request: Request,
  context: RouteContext,
) {
  return proxyRequest(request, context);
}

export async function HEAD(
  request: Request,
  context: RouteContext,
) {
  return proxyRequest(request, context);
}