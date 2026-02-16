"""FocusBoard utility helpers."""

from pathlib import Path
from typing import Optional


def read_file(path: Path) -> Optional[str]:
    """Read file contents, return None if missing."""
    try:
        return path.read_text(encoding="utf-8")
    except (FileNotFoundError, PermissionError):
        return None


def get_quote(philosophy_content: Optional[str]) -> str:
    """Extract quote from philosophy.md."""
    default = "Structure creates freedom. Trust the stacks."

    if not philosophy_content:
        return default

    # Look for blockquote
    for line in philosophy_content.splitlines():
        stripped = line.strip()
        if stripped.startswith("> "):
            quote = stripped[2:].strip().strip('"').strip('"').strip('"')
            if len(quote) > 10:
                return quote

    return default
