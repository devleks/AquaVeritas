"""Render HACKATHON_POSTMORTEM.md to a styled PDF using reportlab.

Handles: H1/H2/H3, paragraphs, bullet lists, tables (pipe-delimited), bold/italic,
inline code, code blocks, horizontal rules. Not a general markdown renderer —
specific to the postmortem's structure.

Usage:
    python docs/generate_postmortem_pdf.py
"""
from __future__ import annotations

import re
from pathlib import Path

from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    KeepTogether, PageBreak, Paragraph, SimpleDocTemplate,
    Spacer, Table, TableStyle,
)

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent
import sys
_NAME = sys.argv[1] if len(sys.argv) > 1 else "HACKATHON_POSTMORTEM"
MD_PATH = ROOT / f"{_NAME}.md"
PDF_PATH = ROOT / f"{_NAME}.pdf"

# ── Colours ───────────────────────────────────────────────────────────────────
INK         = HexColor("#1A1F2E")
INK_MUTED   = HexColor("#5C6B82")
ACCENT      = HexColor("#1F4FA0")
ACCENT_SOFT = HexColor("#E8EEF8")
RULE        = HexColor("#D7DCE3")
CODE_BG     = HexColor("#F4F5F7")

# ── Styles ────────────────────────────────────────────────────────────────────
ss = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=ss["Heading1"], fontName="Helvetica-Bold",
                    fontSize=20, leading=24, textColor=INK,
                    spaceBefore=14, spaceAfter=10)
H2 = ParagraphStyle("H2", parent=ss["Heading2"], fontName="Helvetica-Bold",
                    fontSize=14, leading=18, textColor=ACCENT,
                    spaceBefore=14, spaceAfter=8)
H3 = ParagraphStyle("H3", parent=ss["Heading3"], fontName="Helvetica-Bold",
                    fontSize=11, leading=14, textColor=INK,
                    spaceBefore=10, spaceAfter=4)
BODY = ParagraphStyle("Body", parent=ss["BodyText"], fontName="Helvetica",
                      fontSize=9.5, leading=13.5, textColor=INK,
                      spaceBefore=2, spaceAfter=6, alignment=0)
BULLET = ParagraphStyle("Bullet", parent=BODY, leftIndent=14,
                        bulletIndent=2, spaceBefore=1, spaceAfter=2)
CODE = ParagraphStyle("Code", parent=BODY, fontName="Courier",
                      fontSize=8.5, leading=11, backColor=CODE_BG,
                      borderColor=RULE, borderWidth=0.4, borderPadding=4,
                      leftIndent=4, rightIndent=4, spaceBefore=4, spaceAfter=6)
MUTED = ParagraphStyle("Muted", parent=BODY, fontSize=8.5,
                       textColor=INK_MUTED, italic=True)


# ── Inline formatting ─────────────────────────────────────────────────────────
def inline(text: str) -> str:
    """Convert markdown inline syntax to reportlab paragraph markup."""
    # Escape XML special chars first
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    # Bold
    text = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)
    # Italic (single asterisk, not part of bold)
    text = re.sub(r"(?<![\*])\*([^*\n]+)\*(?![\*])", r"<i>\1</i>", text)
    # Inline code
    text = re.sub(r"`([^`]+)`",
                  r'<font name="Courier" backColor="#F4F5F7">\1</font>', text)
    return text


# ── Block parsers ─────────────────────────────────────────────────────────────
def split_table_row(row: str) -> list[str]:
    """Split a pipe-delimited row, stripping the outer pipes."""
    cells = row.strip().strip("|").split("|")
    return [c.strip() for c in cells]


def render_table(rows: list[str]) -> Table:
    """Render a markdown table (rows[0]=header, rows[1]=separator, rest=data)."""
    header = split_table_row(rows[0])
    body_rows = [split_table_row(r) for r in rows[2:]]
    n_cols = len(header)
    page_w = A4[0] - 2 * 18 * mm

    # Auto-size columns: first column slightly narrower, rest equal
    if n_cols == 2:
        col_widths = [page_w * 0.35, page_w * 0.65]
    elif n_cols == 3:
        col_widths = [page_w * 0.20, page_w * 0.40, page_w * 0.40]
    elif n_cols == 4:
        col_widths = [page_w * 0.18] + [page_w * 0.82 / 3] * 3
    elif n_cols == 5:
        col_widths = [page_w * 0.06] + [page_w * 0.94 / 4] * 4
    else:
        col_widths = [page_w / n_cols] * n_cols

    cell_style = ParagraphStyle("Cell", parent=BODY, fontSize=8.5, leading=11,
                                spaceBefore=0, spaceAfter=0)
    header_style = ParagraphStyle("CellH", parent=cell_style,
                                  fontName="Helvetica-Bold", textColor=white)

    data = [[Paragraph(inline(c), header_style) for c in header]]
    for row in body_rows:
        # Pad short rows
        while len(row) < n_cols:
            row.append("")
        data.append([Paragraph(inline(c), cell_style) for c in row[:n_cols]])

    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
        ("TEXTCOLOR",  (0, 0), (-1, 0), white),
        ("LINEBELOW",  (0, 0), (-1, 0), 0.6, INK),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, ACCENT_SOFT]),
        ("LINEBELOW",  (0, 1), (-1, -1), 0.2, RULE),
        ("VALIGN",     (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING",  (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING",   (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 4),
    ]))
    return t


def is_table_row(line: str) -> bool:
    return line.strip().startswith("|") and line.strip().endswith("|")


def is_separator_row(line: str) -> bool:
    s = line.strip().strip("|")
    return bool(re.match(r"^[\s:|-]+$", s)) and "-" in s


# ── Main parse loop ───────────────────────────────────────────────────────────
def parse_markdown(md: str) -> list:
    """Return a list of flowables for SimpleDocTemplate."""
    story: list = []
    lines = md.splitlines()
    i = 0
    n = len(lines)

    while i < n:
        line = lines[i]
        stripped = line.strip()

        # Skip empty lines
        if not stripped:
            i += 1
            continue

        # Horizontal rule
        if stripped == "---":
            story.append(Spacer(1, 4))
            t = Table([[""]], colWidths=[A4[0] - 36 * mm])
            t.setStyle(TableStyle([("LINEABOVE", (0, 0), (-1, -1), 0.5, RULE)]))
            story.append(t)
            story.append(Spacer(1, 4))
            i += 1
            continue

        # Code block
        if stripped.startswith("```"):
            i += 1
            buf = []
            while i < n and not lines[i].strip().startswith("```"):
                buf.append(lines[i])
                i += 1
            i += 1  # skip closing fence
            code_text = "\n".join(buf).replace("&", "&amp;") \
                                       .replace("<", "&lt;").replace(">", "&gt;")
            story.append(Paragraph(code_text.replace("\n", "<br/>"), CODE))
            continue

        # Tables
        if is_table_row(line):
            table_rows = []
            while i < n and is_table_row(lines[i]):
                table_rows.append(lines[i])
                i += 1
            if len(table_rows) >= 2 and is_separator_row(table_rows[1]):
                story.append(Spacer(1, 4))
                story.append(render_table(table_rows))
                story.append(Spacer(1, 6))
            else:
                # Not a real table — render as paragraphs
                for r in table_rows:
                    story.append(Paragraph(inline(r), BODY))
            continue

        # Headings
        if stripped.startswith("# "):
            story.append(Paragraph(inline(stripped[2:]), H1))
            i += 1
            continue
        if stripped.startswith("## "):
            story.append(Paragraph(inline(stripped[3:]), H2))
            i += 1
            continue
        if stripped.startswith("### "):
            story.append(Paragraph(inline(stripped[4:]), H3))
            i += 1
            continue

        # Bullets and numbered lists
        if re.match(r"^\s*[-*]\s+", line):
            content = re.sub(r"^\s*[-*]\s+", "", line)
            story.append(Paragraph("&bull;&nbsp;" + inline(content), BULLET))
            i += 1
            continue
        if re.match(r"^\s*\d+\.\s+", line):
            content = re.sub(r"^\s*(\d+)\.\s+", r"\1.&nbsp;", line)
            story.append(Paragraph(inline(content), BULLET))
            i += 1
            continue

        # Italic-only line (timestamps and signature)
        if stripped.startswith("*") and stripped.endswith("*") \
                and not stripped.startswith("**"):
            story.append(Paragraph(inline(stripped), MUTED))
            i += 1
            continue

        # Regular paragraph — collect until blank line
        para_lines = [line]
        i += 1
        while i < n and lines[i].strip() \
                and not lines[i].lstrip().startswith(("#", "-", "*", "|", "```")) \
                and not re.match(r"^\s*\d+\.\s+", lines[i]) \
                and lines[i].strip() != "---":
            para_lines.append(lines[i])
            i += 1
        text = " ".join(l.strip() for l in para_lines)
        story.append(Paragraph(inline(text), BODY))

    return story


# ── Render ────────────────────────────────────────────────────────────────────
def render() -> None:
    md = MD_PATH.read_text()
    story = parse_markdown(md)

    doc = SimpleDocTemplate(
        str(PDF_PATH), pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=18 * mm, bottomMargin=18 * mm,
        title="AquaVeritas Hackathon Postmortem and v2 Action Plan",
        author="AquaVeritas",
    )
    doc.build(story)
    size_kb = PDF_PATH.stat().st_size / 1024
    print(f"PDF written: {PDF_PATH} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    render()
