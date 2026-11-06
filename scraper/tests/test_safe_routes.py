"""Offline request-routing regression tests: no real sites or browsers needed."""
import asyncio
from dataclasses import dataclass

import pytest

from pricewatch.network_guard import PublicNetworkGuard, UnsafeNetworkTargetError
from pricewatch.safe_routes import RequestBudget, guarded_route


@dataclass
class FakeResponse:
    status: int = 200
    headers: dict | None = None
    payload: bytes = b"ok"

    async def body(self):
        return self.payload


class FakeRequest:
    url = "https://shop.example/product"
    method = "GET"
    headers = {"x-test": "ok", "authorization": "Bearer secret", "cookie": "auth=1"}
    post_data_buffer = None
    resource_type = "document"

    def is_navigation_request(self):
        return True


class FakeRoute:
    def __init__(self, request=None):
        self.request = request or FakeRequest()
        self.aborted = None
        self.fulfilled = None

    async def abort(self, reason):
        self.aborted = reason

    async def fulfill(self, **kwargs):
        self.fulfilled = kwargs


class FakeAPI:
    def __init__(self, responses):
        self.responses = iter(responses)
        self.calls = []

    async def fetch(self, url, **kwargs):
        self.calls.append((url, kwargs))
        return next(self.responses)


async def public_resolver(_hostname, _port):
    return {"93.184.216.34"}


def guard():
    return PublicNetworkGuard(resolver=public_resolver)


def test_public_page_fulfilled_without_browser_network():
    async def scenario():
        request = FakeRoute()
        api = FakeAPI([FakeResponse(200, {"content-length": "2"}, b"ok")])
        await guarded_route(request, guard(), RequestBudget(), api)
        assert request.fulfilled["body"] == b"ok"
        assert request.aborted is None
        assert len(api.calls) == 1
        assert api.calls[0][1]["max_redirects"] == 0
    asyncio.run(scenario())


@pytest.mark.parametrize("bad_location", [
    "http://127.0.0.1/admin", "http://192.168.1.1/", "file:///etc/passwd",
    "https://user:password@example.net", "http://169.254.169.254/latest/meta-data",
    "https://example.net:9000/admin", "http://[::1]/",
])
def test_redirect_blocked_before_private_target_is_fetched(bad_location):
    async def scenario():
        route = FakeRoute()
        api = FakeAPI([FakeResponse(302, {"location": bad_location})])
        with pytest.raises(UnsafeNetworkTargetError):
            await guarded_route(route, guard(), RequestBudget(), api)
        assert len(api.calls) == 1
        assert route.aborted == "blockedbyclient"
    asyncio.run(scenario())


def test_public_redirects_validated_each_hop_no_credential_leak():
    async def scenario():
        route = FakeRoute()
        api = FakeAPI([
            FakeResponse(301, {"location": "https://other.example/page"}),
            FakeResponse(200, {"content-type": "text/html", "set-cookie": "session=foo"}, b"PRICE"),
        ])
        await guarded_route(route, guard(), RequestBudget(), api)
        assert len(api.calls) == 2
        assert api.calls[1][0] == "https://other.example/page"
        assert "authorization" not in api.calls[1][1]["headers"]
        assert "cookie" not in api.calls[1][1]["headers"]
        assert route.fulfilled["body"] == b"PRICE"
    asyncio.run(scenario())


def test_redirect_budget_rejects_infinite_loops():
    async def scenario():
        route = FakeRoute()
        api = FakeAPI([FakeResponse(302, {"location": "/loop"})] * 10)
        with pytest.raises(UnsafeNetworkTargetError, match="redirect limit"):
            await guarded_route(route, guard(), RequestBudget(), api)
        assert len(api.calls) == 9
    asyncio.run(scenario())


def test_rejects_large_response():
    async def scenario():
        route = FakeRoute()
        api = FakeAPI([FakeResponse(200, {"content-length": str(30 * 1024 * 1024)})])
        with pytest.raises(UnsafeNetworkTargetError, match="size limit"):
            await guarded_route(route, guard(), RequestBudget(), api)
        assert route.aborted == "blockedbyclient"
    asyncio.run(scenario())


def test_image_resource_has_no_network_fetch():
    async def scenario():
        request = FakeRequest()
        request.resource_type = "image"
        route = FakeRoute(request)
        api = FakeAPI([])
        await guarded_route(route, guard(), RequestBudget(), api)
        assert route.aborted == "blockedbyclient"
        assert not api.calls
    asyncio.run(scenario())


def test_request_budget_terminates_unbounded_requests():
    async def scenario():
        api = FakeAPI([FakeResponse(200, {})])
        route = FakeRoute()
        with pytest.raises(UnsafeNetworkTargetError, match="request budget"):
            await guarded_route(route, guard(), RequestBudget(limit=0), api)
        assert not api.calls
    asyncio.run(scenario())
