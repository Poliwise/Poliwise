import re
from src.models.extraction import StructuredText


class DocumentPolicyStandardizer:
    """Detects and standardizes Vietnamese document structure."""

    HEADING_PATTERNS = [
        (r"^(CHAPTER|Chapter)\s+([IVXLCDM]+|\d+)\s*[:\-]?\s*(.*)$", 1),
        (r"^(ARTICLE|Article)\s+(\d+)\s*[:\-]?\s*(.*)$", 2),
        (r"^(CLAUSE|Clause)\s+(\d+)\s*[:\-]?\s*(.*)$", 3),
        (r"^(POINT|Point)\s+([a-z])\s*[:\-]?\s*(.*)$", 4),
        (r"^(SECTION|Section)\s+(\d+)\s*[:\-]?\s*(.*)$", 2),
    ]

    def normalize(self, raw_text: str) -> StructuredText:
        """
        Normalize text with Unicode normalization, whitespace cleanup, and heading detection.
        Returns structured text with sections and headings.
        """
        # Unicode normalization (NFC)
        import unicodedata
        normalized = unicodedata.normalize("NFC", raw_text)

        # Whitespace cleanup
        normalized = re.sub(r"[ \t]+", " ", normalized)
        normalized = re.sub(r"\n{3,}", "\n\n", normalized)

        # Heading detection
        headings = []
        sections = []

        for line in normalized.split("\n"):
            for pattern, level in self.HEADING_PATTERNS:
                match = re.match(pattern, line)
                if match:
                    headings.append({
                        "text": line,
                        "level": level,
                    })
                    sections.append({
                        "heading": line,
                        "level": level,
                        "content": "",
                    })
                    break

        return StructuredText(
            normalized_text=normalized,
            headings=headings,
            sections=sections,
        )
