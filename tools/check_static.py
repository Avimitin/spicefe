#!/usr/bin/env python3
"""Small stdlib-only integrity check for the deployable static directory."""

from __future__ import annotations

import json
import pathlib
import re
import sys
from html.parser import HTMLParser
from urllib.parse import urlsplit


CSS_URL = re.compile(r"url\(\s*(['\"]?)(.*?)\1\s*\)")


class DocumentParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.ids: set[str] = set()
        self.duplicates: set[str] = set()
        self.references: list[str] = []
        self.external_code: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        element_id = values.get("id")
        if element_id:
            if element_id in self.ids:
                self.duplicates.add(element_id)
            self.ids.add(element_id)

        attribute = "href" if tag in {"a", "link"} else "src" if tag in {"script", "img"} else None
        if attribute and values.get(attribute):
            reference = values[attribute]
            split = urlsplit(reference)
            if split.scheme in {"http", "https"} and tag in {"script", "link"}:
                self.external_code.append(reference)
            elif not split.scheme and not reference.startswith(("#", "data:")):
                self.references.append(split.path)


def main() -> int:
    root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "public").resolve()
    index = root / "index.html"
    parser = DocumentParser()
    parser.feed(index.read_text(encoding="utf-8"))

    errors: list[str] = []
    if parser.duplicates:
        errors.append(f"duplicate HTML ids: {sorted(parser.duplicates)}")
    if parser.external_code:
        errors.append(f"externally hosted executable assets: {parser.external_code}")

    checked_references = list(parser.references)
    for reference in parser.references:
        target = (root / reference).resolve()
        if root not in target.parents and target != root:
            errors.append(f"reference escapes static root: {reference}")
        elif not target.exists():
            errors.append(f"missing static reference: {reference}")
        elif target.suffix == ".css":
            for match in CSS_URL.finditer(target.read_text(encoding="utf-8")):
                css_reference = match.group(2)
                split = urlsplit(css_reference)
                if split.scheme in {"http", "https"}:
                    errors.append(f"externally hosted CSS asset: {css_reference}")
                    continue
                if split.scheme or css_reference.startswith("data:"):
                    continue
                css_target = (target.parent / split.path).resolve()
                if root not in css_target.parents and css_target != root:
                    errors.append(f"CSS reference escapes static root: {css_reference}")
                elif not css_target.exists():
                    errors.append(f"missing CSS asset: {css_reference}")
                else:
                    checked_references.append(str(css_target.relative_to(root)))

    for json_file in [root / "site.webmanifest"]:
        try:
            json.loads(json_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            errors.append(f"invalid {json_file.name}: {error}")

    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print(f"checked {index} ({len(parser.ids)} unique ids, {len(checked_references)} local assets)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
