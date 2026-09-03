"""Write build artifacts: data/*.json plus data/*.js script globals.

The .js files make the dashboard render without fetch() — the page can be
opened from file:// or served by GitHub Pages with zero network calls.
"""

import json
import os

GLOBALS = {
    "loans": "LOAN_DATA",
    "summary": "SUMMARY_DATA",
    "insights": "INSIGHTS_DATA",
    "audit": "AUDIT_DATA",
}


def write_artifact(name, payload, outdir="data"):
    os.makedirs(outdir, exist_ok=True)
    json_path = os.path.join(outdir, name + ".json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))

    js_path = os.path.join(outdir, name + ".js")
    with open(js_path, "w", encoding="utf-8") as f:
        f.write(f"window.{GLOBALS[name]} = ")
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";")
    return json_path, js_path


def write_all(loans, summary, insights, audit, outdir="data"):
    written = []
    written.append(write_artifact("loans", loans, outdir))
    written.append(write_artifact("summary", summary, outdir))
    written.append(write_artifact("insights", insights, outdir))
    written.append(write_artifact("audit", audit, outdir))
    return written