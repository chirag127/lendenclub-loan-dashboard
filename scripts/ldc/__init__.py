"""
ldc — modular data pipeline for the LenDenClub (Lending Club India) manual
lending report. Pure Python stdlib: no pandas / openpyxl required.

Modules:
    xlsx     — read .xlsx sheets (zipfile + xml.etree)
    clean    — normalize raw cells into loan records
    summary  — portfolio statistics
    insights — tenure × score cross-tabs, returns economics
    audit    — reconcile every figure against the source report
    emit     — write data/*.json and data/*.js (JS globals, no fetch() needed)

Run the whole pipeline with:  python scripts/build.py <report.xlsx>
"""