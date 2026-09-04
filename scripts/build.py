#!/usr/bin/env python3
"""
Build the dashboard data from the LenDenClub manual lending report.

Modular pipeline (scripts/ldc/*.py, stdlib only — no pandas/openpyxl):
    xlsx     -> read the report sheet
    clean    -> normalize cells into loan records
    summary  -> portfolio statistics
    insights -> tenure × score matrix + returns economics
    audit    -> reconcile every figure against the source report
    emit     -> write data/*.json and data/*.js

Usage:
    python scripts/build.py "C:/path/to/MANUAL_LENDING_REPORT_....xlsx"

Exit code is non-zero when any audit check FAILs, so the pipeline can be
wired into CI to guarantee the dashboard always ships verified data.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ldc import clean, emit, insights, summary as summary_mod, audit as audit_mod, xlsx  # noqa: E402


def main():
    if len(sys.argv) < 2:
        print("usage: python scripts/build.py <report.xlsx>")
        sys.exit(1)
    path = sys.argv[1]

    print(f"[1/5] reading sheet from {os.path.basename(path)}")
    rows = xlsx.read_sheet(path)

    print("[2/5] normalizing loan records")
    lender, summary = clean.parse_block(rows)
    loans = clean.loan_records(rows)
    stats = summary_mod.portfolio_stats(loans)

    print(f"[3/5] computing insights ({len(loans)} loans)")
    insights_payload = {
        "tenure_matrix": insights.tenure_matrix(loans),
        "returns_by_tenure": insights.returns_by_tenure(loans),
        "overall_returns": insights.overall_returns(loans),
        "interest_collection_rates": insights.interest_collection_rates(loans),
        "npa_by_year": insights.npa_by_year(loans),
        "vintage": insights.vintage(loans, summary.get("to_date")),
        "xirr_returns": insights.xirr_returns(loans),
        "xirr_picks": insights.xirr_picks(loans),
        "active_xirr": insights.active_xirr(loans),
        "expected_emi_timeline": insights.expected_emi_timeline(loans),
    }

    print("[4/5] auditing data against the source report")
    audit = audit_mod.run_audit(loans, summary, stats)
    v = audit["verdict"]

    out = {
        "lender": lender,
        "summary": summary,
        "stats": stats,
        "generated_from": os.path.basename(path),
    }

    print("[5/5] writing data/ artifacts")
    written = emit.write_all(loans, out, insights_payload, audit)
    for json_path, js_path in written:
        print(f"      {os.path.relpath(json_path)}  +  {os.path.relpath(js_path)}")

    print()
    print("=" * 62)
    print(f"AUDIT: {v['passed']}/{v['total']} checks passed"
          f" · {v['info']} info notes · {v['failed']} failed")
    for c in audit["checks"]:
        mark = {"PASS": "✅", "INFO": "ℹ️", "FAIL": "❌"}[c["status"]]
        print(f"  {mark} {c['id']:<3} {c['name']:<42} {c['status']:<5} {c['detail']}")
    print("=" * 62)
    print(f"OK: {len(loans)} loans -> data/*.json + data/*.js")
    print("disbursed:", summary["disbursed_amount"], "| received:", summary["total_amount_received"])
    print("status:", stats["status_counts"])

    sys.exit(1 if v["failed"] else 0)


if __name__ == "__main__":
    main()