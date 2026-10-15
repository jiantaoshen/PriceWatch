from __future__ import annotations

import asyncio
import ipaddress
import re
import socket
import time
from dataclasses import dataclass
from typing import Awaitable, Callable, Iterable
from urllib.parse import urlsplit


class UnsafeNetworkTargetError(ValueError):
    """Raised when a URL could reach a non-public network target."""


@dataclass(frozen=True)
class PublicHttpTarget:
    scheme: str
    host: str
    port: int


Resolver = Callable[[str, int], Awaitable[Iterable[str]]]

_LOCAL_HOST_SUFFIXES = (
    ".localhost",
    ".local",
    ".localdomain",
    ".lan",
    ".internal",
    ".home.arpa",
)

_HOST_LABEL_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$", re.IGNORECASE)


def _normalize_hostname(hostname: str) -> str:
    host = hostname.rstrip(".").lower()
    if not host:
        raise UnsafeNetworkTargetError("Target hostname is missing.")

    try:
        return host.encode("idna").decode("ascii")
    except UnicodeError as error:
        raise UnsafeNetworkTargetError("Target hostname is invalid.") from error


def _is_public_ip(address: str) -> bool:
    try:
        return ipaddress.ip_address(address).is_global
    except ValueError:
        return False


def parse_public_http_target(url: str) -> PublicHttpTarget:
    """Validate URL syntax and reject obvious local/private targets before DNS."""
    try:
        parsed = urlsplit(url)
    except ValueError as error:
        raise UnsafeNetworkTargetError("Target URL is invalid.") from error

    scheme = parsed.scheme.lower()
    if scheme not in {"http", "https"}:
        raise UnsafeNetworkTargetError("Only HTTP and HTTPS targets are allowed.")

    if parsed.username is not None or parsed.password is not None:
        raise UnsafeNetworkTargetError("Credentials in target URLs are not allowed.")

    if parsed.hostname is None:
        raise UnsafeNetworkTargetError("Target hostname is missing.")

    host = _normalize_hostname(parsed.hostname)

    if host == "localhost" or host.endswith(_LOCAL_HOST_SUFFIXES):
        raise UnsafeNetworkTargetError("Local network targets are not allowed.")

    try:
        explicit_port = parsed.port
    except ValueError as error:
        raise UnsafeNetworkTargetError("Target port is invalid.") from error

    expected_port = 443 if scheme == "https" else 80
    if explicit_port is not None and explicit_port != expected_port:
        raise UnsafeNetworkTargetError("Non-standard target ports are not allowed.")

    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        # PriceWatch tracks public websites, so single-label DNS names such as
        # "router" or "intranet" have no valid use here and are rejected
        # before they can trigger a local DNS lookup.
        if "." not in host:
            raise UnsafeNetworkTargetError("Single-label hostnames are not allowed.")

        labels = host.split(".")
        if any(not _HOST_LABEL_RE.fullmatch(label) for label in labels):
            raise UnsafeNetworkTargetError("Target hostname is invalid.")
    else:
        if not ip.is_global:
            raise UnsafeNetworkTargetError("Private or non-public IP targets are not allowed.")

    return PublicHttpTarget(
        scheme=scheme,
        host=host,
        port=explicit_port or expected_port,
    )


class PublicNetworkGuard:
    """Fail-closed network policy for the Playwright execution boundary.

    Every HTTP(S) request is checked immediately before Playwright is allowed
    to continue it. DNS answers are accepted only when *all* resolved
    addresses are globally routable.
    """

    def __init__(
        self,
        *,
        resolver: Resolver | None = None,
        dns_timeout_seconds: float = 5.0,
        cache_ttl_seconds: float = 15.0,
    ) -> None:
        self._resolver = resolver or self._resolve_addresses
        self._dns_timeout_seconds = dns_timeout_seconds
        self._cache_ttl_seconds = cache_ttl_seconds
        self._cache: dict[tuple[str, int], float] = {}
        self._inflight: dict[tuple[str, int], asyncio.Task[None]] = {}

    async def validate_url(self, url: str, *, use_cache: bool = True) -> PublicHttpTarget:
        target = parse_public_http_target(url)

        # Literal public IPs have already been fully validated.
        try:
            ipaddress.ip_address(target.host)
            return target
        except ValueError:
            pass

        key = (target.host, target.port)
        now = time.monotonic()
        if use_cache and self._cache.get(key, 0.0) > now:
            return target

        task = self._inflight.get(key)
        if task is None:
            task = asyncio.create_task(self._validate_dns_target(target))
            self._inflight[key] = task

        try:
            await task
        finally:
            if self._inflight.get(key) is task:
                self._inflight.pop(key, None)

        if use_cache:
            self._cache[key] = time.monotonic() + self._cache_ttl_seconds

        return target

    async def _validate_dns_target(self, target: PublicHttpTarget) -> None:
        try:
            addresses = list(
                await asyncio.wait_for(
                    self._resolver(target.host, target.port),
                    timeout=self._dns_timeout_seconds,
                )
            )
        except (asyncio.TimeoutError, OSError, socket.gaierror) as error:
            raise UnsafeNetworkTargetError("Target hostname could not be safely resolved.") from error

        if not addresses:
            raise UnsafeNetworkTargetError("Target hostname did not resolve to an address.")

        if any(not _is_public_ip(address) for address in addresses):
            raise UnsafeNetworkTargetError("Target hostname resolves to a non-public network address.")

    @staticmethod
    async def _resolve_addresses(host: str, port: int) -> Iterable[str]:
        loop = asyncio.get_running_loop()
        infos = await loop.getaddrinfo(
            host,
            port,
            family=socket.AF_UNSPEC,
            type=socket.SOCK_STREAM,
            proto=socket.IPPROTO_TCP,
        )
        return {info[4][0] for info in infos}
