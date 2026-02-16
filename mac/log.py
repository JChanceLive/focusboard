"""FocusBoard logging configuration."""

import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

_configured = False

LOG_PATH = Path.home() / ".claude" / "pi" / "focusboard.log"


def get_logger(name: str) -> logging.Logger:
    """Return a logger under the focusboard namespace.

    First call configures handlers:
    - RotatingFileHandler -> ~/.claude/pi/focusboard.log (1MB, 2 backups)
    - StreamHandler -> stderr at WARNING level
    """
    global _configured
    logger = logging.getLogger(f"focusboard.{name}")

    if not _configured:
        root = logging.getLogger("focusboard")
        root.setLevel(logging.DEBUG)

        LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        fh = RotatingFileHandler(LOG_PATH, maxBytes=1_000_000, backupCount=2)
        fh.setLevel(logging.DEBUG)
        fh.setFormatter(logging.Formatter("%(asctime)s %(name)s %(levelname)s %(message)s"))
        root.addHandler(fh)

        sh = logging.StreamHandler(sys.stderr)
        sh.setLevel(logging.WARNING)
        sh.setFormatter(logging.Formatter("%(name)s %(levelname)s %(message)s"))
        root.addHandler(sh)

        _configured = True

    return logger
