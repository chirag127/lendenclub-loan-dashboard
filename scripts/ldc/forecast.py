"""Forward income forecast for FY 2026–27.

This module deliberately separates three things that are easy to confuse:

* cash returned from today's active loans (principal + interest, less fees);
* net income from today's active loans (interest, less fees and expected NPA loss);
* additional net income created when returned cash is reinvested monthly into
  evidence-backed tenure × score cells.

The source report has no dated EMI ledger, so future EMIs are estimated from
an equal-monthly-installment schedule and the observed principal already paid.
All profit figures are after the platform fee model and historical
(default-inclusive) credit losses; principal returned is never called income.
"""

from datetime import date

from . import insights

FY_START = date(2026, 4, 1)
FY_END = date(2027, 3, 31)
CONSERVATIVE_HAIRCUT = 0.75


def _parse_date(value):
    try:
        return date.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        return None


def _month_key(value):
    return value.strftime("%Y-%m")


def _months_between(start, end):
    return (end.year - start.year) * 12 + end.month - start.month


def _tenure_default_rates(loans):
    out = {}
    for t in insights.TENURES:
        matured = [l for l in loans
                   if int(l.get("tenure") or 0) == t
                   and l.get("status") in ("CLOSED", "NPA")]
        out[t] = (100.0 * sum(1 for l in matured if l["status"] == "NPA") / len(matured)) if matured else 0.0
    return out


def _interest_collection_rates(loans):
    out = {}
    for t in insights.TENURES:
        closed = [l for l in loans
                  if int(l.get("tenure") or 0) == t and l.get("status") == "CLOSED"]
        contracted = sum(max(0.0, (l.get("total_repayment") or 0) - (l.get("amount") or 0))
                        for l in closed)
        received = sum(l.get("interest_received") or 0 for l in closed)
        out[t] = (100.0 * received / contracted) if contracted else 70.0
    return out


def _fee_rate(l):
    month = (l.get("disbursement_date") or "")[:7]
    return float(insights._fee_rate(l.get("tenure"), month) or 0.0)


def _eligible_cells(picks):
    """Strict cells used for reinvestment income, not merely all positive cells."""
    cells = [c for c in (picks or {}).get("cells", [])
             if (c.get("matured") or 0) >= 30
             and (c.get("xirr_all") or 0) > 0
             and (c.get("def_rate") or 0) <= 8
             and (c.get("net_1000") or 0) > 0]
    if not cells:
        return {"cells": [], "xirr": None, "cycle_margin": 0.0, "tenure": None}
    weight = sum(c.get("rec_pct") or 0 for c in cells)
    if not weight:
        weight = sum(c.get("disb") or 0 for c in cells)
        get_weight = lambda c: (c.get("disb") or 0) / weight
    else:
        get_weight = lambda c: (c.get("rec_pct") or 0) / weight
    return {
        "cells": cells,
        "xirr": round(sum((c.get("xirr_all") or 0) * get_weight(c) for c in cells), 1),
        "cycle_margin": sum((c.get("net_1000") or 0) / 1000.0 * get_weight(c) for c in cells),
        "tenure": sum((c.get("tenure") or 0) * get_weight(c) for c in cells),
    }


def fy_forecast(loans, picks, active_payload=None, report_end=None):
    """Forecast FY 2026–27 income from the current portfolio.

    Existing active loans are projected only from installments after the
    report snapshot and through 2027-03. Expected principal return is reduced
    by the observed matured NPA rate for that tenure; future interest is reduced
    by the observed closed-loan interest-collection rate; the fee is charged on
    expected principal returned. A future NPA loss is booked at the first
    projected installment of each active loan.

    All post-report cash is assumed to be reinvested in the strict eligible
    cells (>=30 matured loans, positive default-inclusive net XIRR, <=8%
    matured NPA). New-loan profit is accrued evenly from the month after
    reinvestment through the selected cell's average tenure. This is an
    economic-income projection, not a promise of cash available to withdraw.
    """
    dated = [_parse_date(l.get("disbursement_date")) for l in loans]
    latest = max((d for d in dated if d), default=date(2026, 9, 4))
    requested = _parse_date(report_end)
    as_of = requested if requested and requested >= latest else latest
    as_of = max(as_of, FY_START)

    months = []
    y, m = FY_START.year, FY_START.month
    while (y, m) <= (FY_END.year, FY_END.month):
        months.append(f"{y:04d}-{m:02d}")
        m += 1
        if m == 13:
            y, m = y + 1, 1

    buckets = {month: {
        "month": month, "existing_cash": 0.0, "existing_principal": 0.0,
        "existing_interest": 0.0, "existing_fee": 0.0,
        "existing_npa_loss": 0.0, "existing_net_profit": 0.0,
    } for month in months}
    default_rates = _tenure_default_rates(loans)
    collection_rates = _interest_collection_rates(loans)
    active = [l for l in loans if l.get("status") == "ACTIVE"
              and (l.get("amount") or 0) > 0 and l.get("repayment_start")
              and (l.get("total_repayment") or 0) > 0]

    for l in active:
        t = int(l.get("tenure") or 1)
        amount = float(l.get("amount") or 0)
        principal_received = float(l.get("principal_received") or 0)
        outstanding = max(0.0, amount - principal_received)
        if t < 1 or outstanding <= 0:
            continue
        principal_per_emi = amount / t
        paid = int(round(principal_received / principal_per_emi)) if principal_per_emi else 0
        paid = max(0, min(t, paid))
        remaining = max(1, t - paid)
        future_interest = max(0.0, (l.get("total_repayment") or 0)
                              - amount - (l.get("interest_received") or 0))
        survival = max(0.0, 1.0 - default_rates.get(t, 0.0) / 100.0)
        interest_factor = max(0.0, collection_rates.get(t, 70.0) / 100.0)
        fee_rate = _fee_rate(l) / 100.0
        repayment_start = _parse_date(l.get("repayment_start"))
        if not repayment_start:
            continue

        future_indices = []
        for i in range(paid, t):
            due = _parse_date(insights._add_months(repayment_start.isoformat(), i))
            if due and due > as_of and FY_START <= due <= FY_END:
                future_indices.append((i, due))
        if not future_indices:
            continue

        for position, (i, due) in enumerate(future_indices):
            month = _month_key(due)
            b = buckets[month]
            # Divide expected remaining economics across all remaining EMIs,
            # not only the months that happen to fall inside this FY.
            expected_principal = outstanding * survival / remaining
            expected_interest = future_interest * interest_factor / remaining
            fee = expected_principal * fee_rate
            npa_loss = outstanding * (1.0 - survival) if position == 0 else 0.0
            b["existing_principal"] += expected_principal
            b["existing_interest"] += expected_interest
            b["existing_fee"] += fee
            b["existing_npa_loss"] += npa_loss
            b["existing_cash"] += expected_principal + expected_interest - fee
            b["existing_net_profit"] += expected_interest - fee - npa_loss

    eligible = _eligible_cells(picks)
    # Reinvest all expected post-report cash in the next eligible cells. The
    # cohort list lets a March reinvestment earn only one month's new-loan
    # income, rather than pretending a full tenure completes inside the FY.
    cohorts = []
    for month in months:
        b = buckets[month]
        reinvested = max(0.0, b["existing_cash"])
        cohorts.append({"month": month, "principal": reinvested})
        new_profit = 0.0
        if eligible["cycle_margin"] > 0 and eligible["tenure"]:
            for cohort in cohorts:
                age = _months_between(
                    date(int(cohort["month"][:4]), int(cohort["month"][5:7]), 1),
                    date(int(month[:4]), int(month[5:7]), 1),
                )
                if 1 <= age <= max(1, round(eligible["tenure"])):
                    new_profit += cohort["principal"] * eligible["cycle_margin"] / max(1, round(eligible["tenure"]))
        b["reinvested"] = reinvested
        b["new_profit"] = new_profit
        b["total_net_profit"] = b["existing_net_profit"] + new_profit
        b["conservative_new_profit"] = new_profit * CONSERVATIVE_HAIRCUT
        b["conservative_total_net_profit"] = b["existing_net_profit"] + new_profit * CONSERVATIVE_HAIRCUT

    existing_profit = sum(b["existing_net_profit"] for b in buckets.values())
    existing_cash = sum(b["existing_cash"] for b in buckets.values())
    existing_principal = sum(b["existing_principal"] for b in buckets.values())
    existing_interest = sum(b["existing_interest"] for b in buckets.values())
    existing_fee = sum(b["existing_fee"] for b in buckets.values())
    existing_loss = sum(b["existing_npa_loss"] for b in buckets.values())
    reinvested = sum(b["reinvested"] for b in buckets.values())
    new_profit = sum(b["new_profit"] for b in buckets.values())
    conservative_new_profit = sum(b["conservative_new_profit"] for b in buckets.values())
    start_capital = sum(max(0.0, (l.get("amount") or 0) - (l.get("principal_received") or 0))
                        for l in active)

    return {
        "fy": "2026–27",
        "start": FY_START.isoformat(),
        "end": FY_END.isoformat(),
        "as_of": as_of.isoformat(),
        "starting_active_principal": round(start_capital, 2),
        "active_loans": len(active),
        "existing_book": {
            "cash_received_after_fee": round(existing_cash, 2),
            "principal_returned": round(existing_principal, 2),
            "interest_received": round(existing_interest, 2),
            "platform_fee": round(existing_fee, 2),
            "expected_npa_loss": round(existing_loss, 2),
            "net_profit": round(existing_profit, 2),
        },
        "reinvestment": {
            "cash_reinvested": round(reinvested, 2),
            "eligible_cells": [c.get("key") for c in eligible["cells"]],
            "eligible_cell_count": len(eligible["cells"]),
            "eligible_net_xirr": eligible["xirr"],
            "eligible_cycle_margin": round(100.0 * eligible["cycle_margin"], 2),
            "eligible_average_tenure": round(eligible["tenure"], 1) if eligible["tenure"] else None,
            "new_loan_net_profit": round(new_profit, 2),
            "new_loan_net_profit_conservative": round(conservative_new_profit, 2),
            "conservative_haircut": CONSERVATIVE_HAIRCUT,
        },
        "total_net_profit": round(existing_profit + new_profit, 2),
        "total_net_profit_conservative": round(existing_profit + conservative_new_profit, 2),
        "profit_rate_on_start_pct": round(100.0 * (existing_profit + new_profit) / start_capital, 2) if start_capital else None,
        "profit_rate_on_start_conservative_pct": round(100.0 * (existing_profit + conservative_new_profit) / start_capital, 2) if start_capital else None,
        "active_book_expected_xirr": (active_payload or {}).get("portfolio_expected"),
        "active_book_no_default_xirr": (active_payload or {}).get("portfolio_no_default"),
        "months": [{k: round(v, 2) if isinstance(v, (int, float)) else v for k, v in b.items()}
                   for b in buckets.values()],
        "note": "Existing-loan income = expected future interest − platform fees − expected NPA principal loss. "
                "Principal returned is cash flow, not income. Future EMIs use equal monthly installments "
                "because the report has no dated EMI ledger; historical matured default rates and closed-loan "
                "interest-collection rates are applied by tenure. All cash returned after fee is reinvested "
                "monthly into cells with >=30 matured loans, positive default-inclusive net XIRR and <=8% "
                "matured NPA. New-loan profit is accrued from the month after reinvestment; the conservative "
                f"case applies a {int(CONSERVATIVE_HAIRCUT * 100)}% haircut to that historical net cycle margin.",
    }
