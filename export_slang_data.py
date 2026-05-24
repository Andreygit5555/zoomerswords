import json
import re
from pathlib import Path

import pandas as pd


SOURCE = Path("/Users/Andrey/Downloads/zoomer_slang.xlsx")
OUTPUT = Path(__file__).with_name("slang-data.js")


def clean_text(value):
    if pd.isna(value):
        return ""
    return re.sub(r"\s+", " ", str(value).strip())


def clean_answer(value):
    word = clean_text(value).replace("ё", "е").replace("Ё", "Е").upper()
    return re.sub(r"[^А-Я]", "", word)


def main():
    frame = pd.read_excel(SOURCE, sheet_name="Зумерский сленг")
    rows = []
    seen = set()

    for _, row in frame.iterrows():
        word = clean_text(row.get("Слово"))
        definition = clean_text(row.get("Значение"))
        category = clean_text(row.get("Категория")) or "Сленг"
        answer = clean_answer(word)

        if not word or not definition:
            continue
        if len(answer) < 4 or len(answer) > 9:
            continue
        if answer in seen:
            continue

        seen.add(answer)
        rows.append(
            {
                "word": word,
                "definition": definition,
                "category": category,
            }
        )

    payload = json.dumps(rows, ensure_ascii=False, indent=2)
    OUTPUT.write_text(
        "// Generated from /Users/Andrey/Downloads/zoomer_slang.xlsx\n"
        f"window.ZOOMER_WORDS = {payload};\n",
        encoding="utf-8",
    )
    print(f"Exported {len(rows)} words to {OUTPUT}")


if __name__ == "__main__":
    main()
