#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

import pdfplumber


DEFAULT_OUTPUT = Path("src/data/school-zones.json")
DEFAULT_SOURCES = {
    "elementary": Path("/Users/jsdryan/Downloads/6390815202945559934835907.pdf"),
    "juniorHigh": Path("/Users/jsdryan/Downloads/115年新北市國中學區.pdf"),
}
LEVEL_CONFIG = {
    "elementary": {
        "label": "國小",
        "schoolKind": "國民小學",
        "fallbackTitle": "新北市各公立國民小學學區一覽表",
        "stopAtAttachment": False,
    },
    "juniorHigh": {
        "label": "國中",
        "schoolKind": "國民中學",
        "fallbackTitle": "新北市各公立國民中學學區一覽表",
        "stopAtAttachment": True,
    },
}


def clean_cell(value: object) -> str:
    if value is None:
        return ""

    text = str(value).replace("\r", "\n")
    text = "".join(line.strip() for line in text.splitlines())
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"(?<=[\u4e00-\u9fff]) (?=[\u4e00-\u9fff])", "", text)
    text = re.sub(r"(?<=[0-9]) (?=[\u4e00-\u9fff])", "", text)
    text = re.sub(r"(?<=[\u4e00-\u9fff]) (?=[0-9])", "", text)
    text = re.sub(r"(?<=[\u4e00-\u9fff]) (?=[（(【])", "", text)
    text = re.sub(r"(?<=[）)】]) (?=[\u4e00-\u9fff])", "", text)
    text = text.replace("(國中部)", "（國中部）")
    return text


def append_text(record: dict[str, Any], key: str, value: str) -> None:
    if not value:
        return

    existing = str(record.get(key, "") or "")
    record[key] = f"{existing}{value}" if existing else value


def is_header_row(cells: list[str]) -> bool:
    joined = "".join(cells)
    return (
        not joined
        or cells[0] in {"學校名稱", "序號"}
        or joined == "調整備註"
        or re.fullmatch(r"\d+學年度調整備註", joined) is not None
        or ("學校名稱" in joined and "基本學區" in joined)
    )


def extract_metadata(
    first_page_text: str,
    source: Path,
    level: str,
) -> dict[str, str]:
    lines = [line.strip() for line in first_page_text.splitlines() if line.strip()]
    config = LEVEL_CONFIG[level]
    title = lines[0] if lines else str(config["fallbackTitle"])
    revision = next(
        (line for line in lines if "月修正" in line or "函核定" in line),
        "",
    )
    entry_age = next((line for line in lines if "入學年齡" in line), "")
    return {
        "title": clean_cell(title),
        "revision": clean_cell(revision),
        "entryAge": clean_cell(entry_age),
        "sourceFile": str(source),
    }


def extract_citywide_rows(table: list[list[object]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for row in table:
        cells = [clean_cell(cell) for cell in row]
        if is_header_row(cells) or not cells[0].isdigit():
            continue

        rows.append(
            {
                "no": int(cells[0]),
                "regionGroup": cells[1],
                "district": cells[2],
                "schoolName": cells[3],
                "notes": cells[4] if len(cells) > 4 else "",
            }
        )
    return rows


def is_attachment_start(text: str) -> bool:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return bool(lines and lines[0] == "附件")


def extract_level_rows(level: str, source: Path) -> dict[str, Any]:
    records: list[dict[str, Any]] = []
    citywide_free_schools: list[dict[str, Any]] = []
    current_district = ""
    current_record: dict[str, Any] | None = None
    config = LEVEL_CONFIG[level]

    with pdfplumber.open(source) as pdf:
        first_page_text = pdf.pages[0].extract_text() or ""
        metadata = extract_metadata(first_page_text, source, level)

        for page_index, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            if config["stopAtAttachment"] and is_attachment_start(text):
                break

            district_match = re.search(
                r"([\u4e00-\u9fff]{1,4}區)\s*\d+\s*學年度國[中小]學區一覽表",
                text,
            )
            if district_match:
                current_district = district_match.group(1)

            for table in page.extract_tables():
                first_row = [clean_cell(cell) for cell in table[0]] if table else []
                if level == "elementary" and first_row[:4] == [
                    "序號",
                    "九大分區",
                    "區別",
                    "校名",
                ]:
                    citywide_free_schools.extend(extract_citywide_rows(table))
                    continue

                for row in table:
                    cells = [clean_cell(cell) for cell in row]
                    if is_header_row(cells):
                        continue

                    school_name = cells[0] if cells else ""
                    basic_area = cells[1] if len(cells) > 1 else ""
                    free_area = cells[2] if len(cells) > 2 else ""
                    notes = "".join(cells[3:]) if len(cells) > 3 else ""

                    if school_name:
                        current_record = {
                            "id": f"{level}-{current_district}-{school_name}-{page_index}",
                            "level": level,
                            "district": current_district,
                            "schoolName": school_name,
                            "basicArea": basic_area,
                            "freeArea": free_area,
                            "notes": notes,
                            "sourcePages": [page_index],
                        }
                        records.append(current_record)
                        continue

                    if current_record is None:
                        continue

                    append_text(current_record, "basicArea", basic_area)
                    append_text(current_record, "freeArea", free_area)
                    append_text(current_record, "notes", notes)
                    pages = current_record.setdefault("sourcePages", [])
                    if isinstance(pages, list) and page_index not in pages:
                        pages.append(page_index)

    districts = sorted({str(row["district"]) for row in records if row.get("district")})
    return {
        "level": level,
        "label": config["label"],
        "schoolKind": config["schoolKind"],
        "metadata": metadata,
        "districts": districts,
        "schools": records,
        "citywideFreeSchools": sorted(
            citywide_free_schools, key=lambda row: int(row["no"])
        ),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract New Taipei school zones")
    parser.add_argument("--elementary-source", type=Path, default=DEFAULT_SOURCES["elementary"])
    parser.add_argument("--junior-high-source", type=Path, default=DEFAULT_SOURCES["juniorHigh"])
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    sources = {
        "elementary": args.elementary_source,
        "juniorHigh": args.junior_high_source,
    }
    payload = {
        "defaultLevel": "elementary",
        "levels": {
            level: extract_level_rows(level, source)
            for level, source in sources.items()
        },
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    for level, dataset in payload["levels"].items():
        print(
            f"{level}: {len(dataset['schools'])} schools, "
            f"{len(dataset['districts'])} districts, "
            f"{len(dataset['citywideFreeSchools'])} citywide free schools"
        )
    print(f"wrote {args.output}")


if __name__ == "__main__":
    main()
