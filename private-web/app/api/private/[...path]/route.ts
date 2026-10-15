const DEFAULT_PRIVATE_API_URL = "http://127.0.0.1:5188";
const DEFAULT_PRIVATE_FRONTEND_URL = "http://127.0.0.1:3001";
const CLIENT_HEADER = "X-PriceWatch-Client";
const CLIENT_HEADER_VALUE = "private-web";
const TOKEN_HEADER = "X-PriceWatch-Token";
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function problem(status: number, title: string) {
  return Response.json(
    { status, title },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

function isLoopbackHostname(hostname: string) {
  const normalized = hostname
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .toLowerCase();

  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1"
  );
}

function readProxyConfig() {
  const apiUrl = new URL(
    process.env.PRIVATE_API_URL ?? DEFAULT_PRIVATE_API_URL
  );
  const frontendUrl = new URL(
    process.env.PRIVATE_FRONTEND_URL ?? DEFAULT_PRIVATE_FRONTEND_URL
  );
  const token = process.env.PRIVATE_API_TOKEN;

  if (
    !["http:", "https:"].includes(apiUrl.protocol) ||
    !isLoopbackHostname(apiUrl.hostname)
  ) {
    throw new Error("Private API upstream must use a loopback host.");
  }

  if (!token || token.length < 32) {
    throw new Error("Private API token is not configured.");
  }

  return {
    apiUrl,
    frontendOrigin: frontendUrl.origin,
    token,
  };
}

function isTrustedBrowserRequest(
  request: Request,
  frontendOrigin: string
) {
  const requestUrl = new URL(request.url);

  if (requestUrl.origin !== frontendOrigin) {
    return false;
  }

  if (
    request.headers.get(CLIENT_HEADER) !==
    CLIENT_HEADER_VALUE
  ) {
    return false;
  }

  if (!MUTATION_METHODS.has(request.method)) {
    return true;
  }

  const origin = request.headers.get("Origin");
  if (origin) {
    return origin === frontendOrigin;
  }

  return request.headers.get("Sec-Fetch-Site") === "same-origin";
}

async function proxy(request: Request) {
  let config: ReturnType<typeof readProxyConfig>;

  try {
    config = readProxyConfig();
  } catch {
    return problem(500, "Private API proxy is not configured.");
  }

  if (!isTrustedBrowserRequest(request, config.frontendOrigin)) {
    return problem(403, "Forbidden");
  }

  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(
    `${incomingUrl.pathname}${incomingUrl.search}`,
    config.apiUrl
  );

  const headers = new Headers();
  const accept = request.headers.get("Accept");
  const contentType = request.headers.get("Content-Type");

  if (accept) {
    headers.set("Accept", accept);
  }
  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  headers.set(TOKEN_HEADER, config.token);

  let body: ArrayBuffer | undefined;
  if (!["GET", "HEAD"].includes(request.method)) {
    const requestBody = await request.arrayBuffer();
    body = requestBody.byteLength > 0 ? requestBody : undefined;
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
      signal: request.signal,
    });

    const responseHeaders = new Headers({
      "Cache-Control": "no-store",
    });
    const upstreamContentType = upstreamResponse.headers.get("Content-Type");

    if (upstreamContentType) {
      responseHeaders.set("Content-Type", upstreamContentType);
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch {
    return problem(502, "Private API is unavailable.");
  }
}

export function GET(request: Request) {
  return proxy(request);
}

export function POST(request: Request) {
  return proxy(request);
}

export function PUT(request: Request) {
  return proxy(request);
}

export function PATCH(request: Request) {
  return proxy(request);
}

export function DELETE(request: Request) {
  return proxy(request);
}
