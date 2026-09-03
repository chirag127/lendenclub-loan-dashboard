"""Portfolio statistics computed from the parsed loan records."""

from .clean import month_key


def portfolio_stats(loans):
    """All derived portfolio-level counts and averages."""
    status_counts = {}
    repay_counts = {}
    for l in loans:
        status_counts[l["status"]] = status_counts.get(l["status"], 0) + 1
        repay_counts[l["repayment_type"]] = repay_counts.get(l["repayment_type"], 0) + 1

    rates = [l["interest_rate"] for l in loans if l["interest_rate"] is not None]
    tenures = [l["tenure"] for l in loans if l["tenure"] is not None]
    scores = [l["score"] for l in loans if l["score"] is not None]
    amounts = [l["amount"] for l in loans if l["amount"] is not None]

    avg = lambda xs: round(sum(xs) / len(xs), 2) if xs else None

    return {
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
        "avg_interest_rate": avg(rates),
        "avg_tenure_months": avg(tenures),
        "avg_score": avg(scores),
        "min_amount": min(amounts) if amounts else None,
        "max_amount": max(amounts) if amounts else None,
        "months_active": len({month_key(l["disbursement_date"]) for l in loans if l["disbursement_date"]}),
    }