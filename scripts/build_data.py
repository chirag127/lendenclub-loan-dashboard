#!/usr/bin/env python3
"""
Build data/loans.json + data/summary.json from the LenDenClub manual lending
report xlsx. Pure stdlib (zipfile + xml.etree) so no pandas/openpyxl needed.

Usage:
    python scripts/build_data.py "C:/path/to/MANUAL_LENDING_REPORT_....xlsx"

Personal contact details (email / mobile) from the sheet are intentionally NOT
written into the public data files.
"""
import json
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

COLS = [
    "order_id", "loan_id", "disbursement_date", "amount", "repayment_type",
    "repayment_start", "total_repayment", "total_received", "principal_received",
    "interest_received", "platform_fee", "pnl", "npa_amount", "status",
    "closure_date", "dpd", "interest_rate", "tenure", "score",
]

MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def colnum(ref):
    n = 0
    for ch in re.match(r"([A-Z]+)", ref).group(1):
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def cellval(c):
    t = c.get("t")
    if t == "inlineStr":
        return "".join(x.text or "" for x in c.findall(".//" + M + "t"))
    v = c.find(M + "v")
    return v.text or "" if v is not None else ""


def fullrow(r):
    cells = {}
    for c in r.findall(M + "c"):
        ref = c.get("r")
        if ref:
            cells[colnum(ref)] = cellval(c)
    if not cells:
        return []
    return [cells.get(i, "") for i in range(max(cells) + 1)]


def to_num(v):
    """Parse an Indian-format number like '₹26,27,500.0' or '250' or ''."""
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
    """Normalize DD/MM/YYYY or YYYY-MM-DD (or with dashes) to ISO."""
    if not v:
        return None
    s = str(v).strip()
    m = re.match(r"^(\d{2})/(\d{2})/(\d{4})$", s)
    if m:
        return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    m = re.match(r"^(\d{4})[-\s/](\d{2})[-\s/](\d{2})$", s)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    return s


def month_key(iso):
    return iso[:7] if iso else None


def main():
    if len(sys.argv) < 2:
        print("usage: python scripts/build_data.py <report.xlsx>")
        sys.exit(1)
    path = sys.argv[1]
    z = zipfile.ZipFile(path)
    sh = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    rows = sh.findall(M + "sheetData/" + M + "row")
    data = [fullrow(r) for r in rows]

    # ---- lender details & summary block (rows 1-15) ----
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

    # ---- loan rows (row 18 onward) ----
    loans = []
    for r in data[18:]:
        if len(r) < 2 or not r[1]:
            continue
        rec = {}
        for i, key in enumerate(COLS):
            raw = r[i] if i < len(r) else ""
            if key in ("amount", "total_repayment", "total_received", "principal_received",
                       "interest_received", "platform_fee", "pnl", "npa_amount",
                       "dpd", "interest_rate", "tenure", "score"):
                rec[key] = to_num(raw)
            elif key in ("disbursement_date", "repayment_start", "closure_date"):
                rec[key] = to_iso_date(raw)
            else:
                rec[key] = raw.strip() if raw else None
        loans.append(rec)

    loans.sort(key=lambda x: (x["disbursement_date"] or "9999", x["loan_id"] or ""))

    # ---- computed portfolio stats ----
    status_counts = {}
    repay_counts = {}
    for l in loans:
        status_counts[l["status"]] = status_counts.get(l["status"], 0) + 1
        repay_counts[l["repayment_type"]] = repay_counts.get(l["repayment_type"], 0) + 1

    rates = [l["interest_rate"] for l in loans if l["interest_rate"] is not None]
    tenures = [l["tenure"] for l in loans if l["tenure"] is not None]
    scores = [l["score"] for l in loans if l["score"] is not None]
    amounts = [l["amount"] for l in loans if l["amount"] is not None]

    stats = {
        "total_loans": len(loans),
        "status_counts": status_counts,
        "repayment_type_counts": repay_counts,
        "disbursed_with_date": sum(1 for l in loans if l["disbursement_date"]),
        "active_loans": status_counts.get("ACTIVE", 0),
        "closed_loans": status_counts.get("CLOSED", 0),
        "npa_loans": status_counts.get("NPA", 0),
        "processing_loans": status_counts.get("PROCESSING", 0),
        "rejected_loans": status_counts.get("REJECTED", 0),
        "cancelled_loans": status_counts.get("CANCELLED", 0),
        "loans_with_dpd": sum(1 for l in loans if (l["dpd"] or 0) > 0),
        "avg_interest_rate": round(sum(rates) / len(rates), 2) if rates else None,
        "avg_tenure_months": round(sum(tenures) / len(tenures), 2) if tenures else None,
        "avg_score": round(sum(scores) / len(scores), 2) if scores else None,
        "min_amount": min(amounts) if amounts else None,
        "max_amount": max(amounts) if amounts else None,
        "months_active": len({month_key(l["disbursement_date"]) for l in loans if l["disbursement_date"]}),
    }

    out = {
        "lender": lender,
        "summary": summary,
        "stats": stats,
        "generated_from": os.path.basename(path),
    }

    with open("data/loans.json", "w", encoding="utf-8") as f:
        json.dump(loans, f, ensure_ascii=False, separators=(",", ":"))

    with open("data/summary.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

    # JS globals so the page works without fetch() (file://, strict networks, etc.)
    with open("data/loans.js", "w", encoding="utf-8") as f:
        f.write("window.LOAN_DATA = ")
        json.dump(loans, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";")

    with open("data/summary.js", "w", encoding="utf-8") as f:
        f.write("window.SUMMARY_DATA = ")
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";")

    print(f"OK: {len(loans)} loans -> data/loans.json + data/summary.json")
    print("disbursed:", summary["disbursed_amount"], "| received:", summary["total_amount_received"])
    print("status:", status_counts)

    print(f"OK: {len(loans)} loans -> data/loans.json + data/summary.json")
    print("disbursed:", summary["disbursed_amount"], "| received:", summary["total_amount_received"])
    print("status:", stats["status_counts"])


if __name__ == "__main__":
    main()