"""Normalize raw spreadsheet cells into typed loan records.

The LenDenClub manual lending report has a fixed layout:
    rows 1-15    — lender identity + summary KPIs (key/value pairs)
    row 17       — column headers
    rows 18+     — one loan per row

Personal contact details (email / mobile) from the sheet are deliberately
NOT copied into the public data files.
"""

import re

COLS = [
    "order_id", "loan_id", "disbursement_date", "amount", "repayment_type",
    "repayment_start", "total_repayment", "total_received", "principal_received",
    "interest_received", "platform_fee", "pnl", "npa_amount", "status",
    "closure_date", "dpd", "interest_rate", "tenure", "score",
]

NUMERIC = {
    "amount", "total_repayment", "total_received", "principal_received",
    "interest_received", "platform_fee", "pnl", "npa_amount",
    "dpd", "interest_rate", "tenure", "score",
}
DATES = {"disbursement_date", "repayment_start", "closure_date"}

MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def to_num(v):
    """Parse an Indian-format number like '₹26,27,500.0' or '250' or '' -> float|None."""
    if v is None:
        return None
    s = str(v).replace("₹", "").replace(",", "").strip()
    if s in ("", "-", "—", "N/A"):
        return None
    try:
        return round(float(s), 2)
    except ValueError:
        return None


def to_iso_date(v):
    """Normalize DD/MM/YYYY or YYYY-MM-DD to ISO (or return the raw string)."""
    if not v:
        return None
    s = str(v).strip()
    m = re.match(r"^(\d{2})/(\d{2})/(\d{4})$", s)
    if m:
        return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    m = re.match(r"^(\d{4})[-/ ](\d{2})[-/ ](\d{2})$", s)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    return s


def month_key(iso):
    return iso[:7] if iso else None


def parse_block(data):
    """Extract lender identity + summary KPIs from rows 1-15."""
    def kv(row):
        v = data[row]
        return v[1] if len(v) > 1 else ""

    lender = {
        "name": kv(2),
        "user_id": kv(3),
        # email (row 4) and mobile (row 5) deliberately excluded (public repo)
    }
    summary = {
        "from_date": kv(7),
        "to_date": kv(8),
        "disbursed_amount": to_num(kv(9)),
        "total_amount_received": to_num(kv(10)),
        "principal_received": to_num(kv(11)),
        "interest_received": to_num(kv(12)),
        "npa_amount": to_num(kv(13)),
        "platform_fee": to_num(kv(14)),
        "principal_outstanding": to_num(kv(15)),
    }
    return lender, summary


def loan_records(data):
    """Parse rows 18+ into typed loan dicts, skipping blank rows."""
    loans = []
    for r in data[18:]:
        if len(r) < 2 or not r[1]:
            continue
        rec = {}
        for i, key in enumerate(COLS):
            raw = r[i] if i < len(r) else ""
            if key in NUMERIC:
                rec[key] = to_num(raw)
            elif key in DATES:
                rec[key] = to_iso_date(raw)
            else:
                rec[key] = raw.strip() if raw else None
        loans.append(rec)

    loans.sort(key=lambda x: (x["disbursement_date"] or "9999", x["loan_id"] or ""))
    return loans