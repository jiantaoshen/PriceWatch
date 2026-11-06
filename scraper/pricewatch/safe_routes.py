"""Playwright request interception with guarded *every-hop* HTTP redirects.

Never pass potentially redirected requests directly to route.continue_(): Playwright
only calls routing handlers for the first redirect hop. This code asks the
request API for each hop with automatic redirects disabled, validates the next
URL, then fulfills the browser from the validated response.
"""
from __future__ import annotations

from urllib.parse import urljoin

from .network_guard import PublicNetworkGuard, UnsafeNetworkTargetError

MAX_REDIRECTS = 8
MAX_REQUESTS = 160
MAX_RESPONSE_BYTES = 12 * 1024 * 1024
MAX_RESOURCE_TYPES_BLOCKED = frozenset({"image", "media", "font"})
_REDIRECT_STATUSES = frozenset({301, 302, 303, 307, 308})


class RequestBudget:
    """Simple page-level budget; prevents endless network resource fan-out."""

    def __init__(self, limit: int = MAX_REQUESTS) -> None:
        self.limit = limit
        self.count = 0

    def charge(self) -> None:
        self.count += 1
        if self.count > self.limit:
            raise UnsafeNetworkTargetError("Page exceeded the permitted request budget.")


async def guarded_route(route, guard: PublicNetworkGuard, budget: RequestBudget, api_request) -> None:
    """Guard URL, explicit redirects and sizes for a single routed HTTP request."""
    request = route.request
    try:
        budget.charge()
        # No need to fetch image/media/font data for structured price extraction.
        if request.resource_type in MAX_RESOURCE_TYPES_BLOCKED:
            await route.abort("blockedbyclient")
            return

        current_url = request.url
        method = request.method
        headers = dict(request.headers)
        body = request.post_data_buffer
        from urllib.parse import urlsplit
        for hop in range(MAX_REDIRECTS + 1):
            # Resolve each name immediately before *this* network request.
            await guard.validate_url(current_url, use_cache=False if hop else not request.is_navigation_request())
            response = await api_request.fetch(
                current_url,
                method=method,
                headers=headers,
                data=body,
                max_redirects=0,
                timeout=25000,
            )
            location = response.headers.get("location")
            if response.status in _REDIRECT_STATUSES and location:
                if hop == MAX_REDIRECTS:
                    raise UnsafeNetworkTargetError("Page exceeded the redirect limit.")
                following_url = urljoin(current_url, location)
                # Check it *before* requesting it; includes non-http redirects.
                await guard.validate_url(following_url, use_cache=False)
                # Strip headers bound to the original origin. In particular, never
                # forward an Authorization or Cookie header to a different host.
                if ((urlsplit(following_url).scheme, urlsplit(following_url).netloc.lower())
                    != (urlsplit(current_url).scheme, urlsplit(current_url).netloc.lower())):
                    headers = {k: v for k, v in headers.items()
                               if k.lower() not in ("cookie", "authorization", "proxy-authorization", "host")}
                # Standard browser behavior for common redirects with a request body.
                if response.status == 303 or (response.status in (301, 302) and method.upper() == "POST"):
                    method, body = "GET", None
                    headers = {k: v for k, v in headers.items()
                               if k.lower() not in ("content-type", "content-length")}
                current_url = following_url
                budget.charge()
                continue

            declared_size = response.headers.get("content-length")
            if declared_size:
                try:
                    length = int(declared_size)
                except ValueError:
                    length = None
                if length is not None and length > MAX_RESPONSE_BYTES:
                    raise UnsafeNetworkTargetError("Page resource exceeds size limit.")
            content = await response.body()
            if len(content) > MAX_RESPONSE_BYTES:
                raise UnsafeNetworkTargetError("Page resource exceeds size limit.")
            # Explicit body prevents automatic browser redirects (including on
            # unusual responses) and ensures the browser uses validated bytes.
            await route.fulfill(status=response.status, headers={
                name: value for name, value in response.headers.items()
                if name.lower() not in ("content-length", "content-encoding", "transfer-encoding", "location", "set-cookie")
            }, body=content)
            return
        raise UnsafeNetworkTargetError("Page exceeded the redirect limit.")
    except UnsafeNetworkTargetError:
        await route.abort("blockedbyclient")
        raise
    except Exception:
        try:
            await route.abort("failed")
        except Exception:
            pass
        raise
