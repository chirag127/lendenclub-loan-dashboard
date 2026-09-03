"""Read .xlsx worksheets with the standard library only."""

import re
import zipfile
import xml.etree.ElementTree as ET

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def colnum(ref):
    """'B' -> 1, 'AA' -> 26 (0-indexed column number)."""
    n = 0
    for ch in re.match(r"([A-Z]+)", ref).group(1):
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def cellval(c):
    """Value of a <c> cell element (supports inlineStr and shared/numeric v)."""
    t = c.get("t")
    if t == "inlineStr":
        return "".join(x.text or "" for x in c.findall(".//" + NS + "t"))
    v = c.find(NS + "v")
    return v.text or "" if v is not None else ""


def fullrow(r):
    """Expand a <row> into a list of cell values, sparse gaps filled with ''."""
    cells = {}
    for c in r.findall(NS + "c"):
        ref = c.get("r")
        if ref:
            cells[colnum(ref)] = cellval(c)
    if not cells:
        return []
    return [cells.get(i, "") for i in range(max(cells) + 1)]


def read_sheet(path, sheet="xl/worksheets/sheet1.xml"):
    """Return every row of the given sheet as a list of value lists."""
    with zipfile.ZipFile(path) as z:
        sh = ET.fromstring(z.read(sheet))
    rows = sh.findall(NS + "sheetData/" + NS + "row")
    return [fullrow(r) for r in rows]