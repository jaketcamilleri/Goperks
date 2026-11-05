"""Staff can type member/voucher codes with or without dashes, spaces or the GP prefix."""
from routes.partner import read_code


def test_member_codes_any_format():
    for typed in ("GP-8K2Q4M", "gp8k2q4m", "8K2Q4M", "gp 8k2 q4m", "GP 8K2Q4M"):
        assert read_code(typed)[0] == "GP-8K2Q4M"
    assert read_code("lp-abc123")[0] == "LP-ABC123"


def test_voucher_codes_any_format():
    for typed in ("AB12-CD34", "ab12cd34", "AB12 CD34"):
        member, voucher = read_code(typed)
        assert member is None and voucher == "AB12-CD34"
