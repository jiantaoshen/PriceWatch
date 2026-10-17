import asyncio

import pytest

from pricewatch.network_guard import (
    PublicNetworkGuard,
    UnsafeNetworkTargetError,
    parse_public_http_target,
)


@pytest.mark.parametrize(
    "url",
    [
        "file:///etc/passwd",
        "ftp://example.com/file",
        "http://localhost/",
        "http://localhost./",
        "http://router/",
        "http://printer.local/",
        "http://gateway.home.arpa/",
        "http://user:pass@example.com/",
        "https://example.com:8443/",
        "http://127.0.0.1/",
        "http://10.0.0.1/",
        "http://172.16.0.1/",
        "http://192.168.1.1/",
        "http://169.254.169.254/",
        "http://100.64.0.1/",
        "http://[::1]/",
        "http://[fc00::1]/",
        "http://[fe80::1]/",
    ],
)
def test_rejects_non_public_targets_before_navigation(url):
    with pytest.raises(UnsafeNetworkTargetError):
        parse_public_http_target(url)


def test_accepts_normal_public_urls_and_standard_ports():
    assert parse_public_http_target("https://example.com/product").port == 443
    assert parse_public_http_target("http://example.com:80/product").port == 80
    assert parse_public_http_target("https://8.8.8.8/").host == "8.8.8.8"


def test_dns_result_with_any_private_address_is_rejected():
    async def resolver(_host: str, _port: int):
        return {"93.184.216.34", "192.168.1.20"}

    async def scenario():
        guard = PublicNetworkGuard(resolver=resolver)
        with pytest.raises(UnsafeNetworkTargetError):
            await guard.validate_url("https://example.com/")

    asyncio.run(scenario())


def test_dns_result_with_only_public_addresses_is_allowed():
    calls = 0

    async def resolver(_host: str, _port: int):
        nonlocal calls
        calls += 1
        return {"93.184.216.34", "2606:4700:4700::1111"}

    async def scenario():
        guard = PublicNetworkGuard(
            resolver=resolver,
            cache_ttl_seconds=60,
        )
        await guard.validate_url("https://example.com/")
        await guard.validate_url("https://example.com/")

    asyncio.run(scenario())
    assert calls == 1


def test_navigation_can_force_dns_revalidation_even_with_cache():
    calls = 0

    async def resolver(_host: str, _port: int):
        nonlocal calls
        calls += 1
        return {"93.184.216.34"}

    async def scenario():
        guard = PublicNetworkGuard(
            resolver=resolver,
            cache_ttl_seconds=60,
        )
        await guard.validate_url("https://example.com/")
        await guard.validate_url("https://example.com/", use_cache=False)

    asyncio.run(scenario())
    assert calls == 2


def test_forced_navigation_revalidation_detects_dns_rebinding():
    answers = iter([
        {"93.184.216.34"},
        {"127.0.0.1"},
    ])

    async def resolver(_host: str, _port: int):
        return next(answers)

    async def scenario():
        guard = PublicNetworkGuard(
            resolver=resolver,
            cache_ttl_seconds=60,
        )
        await guard.validate_url("https://example.com/")

        with pytest.raises(UnsafeNetworkTargetError):
            await guard.validate_url(
                "https://example.com/",
                use_cache=False,
            )

    asyncio.run(scenario())
