from pricewatch.price_parser import parse_price


def test_swedish_decimal():
    assert parse_price("1 299,00 kr") == 1299.0


def test_dot_thousands():
    assert parse_price("1.299 kr") == 1299.0


def test_us_number():
    assert parse_price("1,299.95") == 1299.95


def test_none():
    assert parse_price(None) is None
