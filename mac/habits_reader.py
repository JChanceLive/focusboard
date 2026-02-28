"""Read habit state from PiPulse Pi API for FocusBoard.

Fetches from HTTP endpoint with file cache fallback for offline resilience.
Replaces the original direct-SQLite reader (pre-Session 4).
"""

import json
import urllib.request

from config import HABITS_API_CACHE, HABITS_API_URL
from log import get_logger

logger = get_logger("habits")


def read_habits_state() -> dict:
    """Fetch habit state from Pi API with file cache fallback.

    Returns the same dict shape as the original SQLite reader:
    {completed, total, completion_pct, xp, level, level_title,
     level_progress, perfect_day_streak, best_streak, tiers}

    Returns {} on any failure so FocusBoard renders without habits.
    """
    try:
        req = urllib.request.urlopen(HABITS_API_URL, timeout=3)
        data = json.loads(req.read().decode("utf-8"))

        # Write cache for offline fallback
        HABITS_API_CACHE.parent.mkdir(parents=True, exist_ok=True)
        HABITS_API_CACHE.write_text(
            json.dumps(data, ensure_ascii=True), encoding="utf-8",
        )

        return data

    except Exception as exc:
        logger.warning("Pi habits API unavailable: %s", exc)

        # Fall back to cached response
        try:
            cached = json.loads(
                HABITS_API_CACHE.read_text(encoding="utf-8")
            )
            logger.info("Using cached habits data")
            return cached
        except Exception:
            logger.warning("No habits cache available")
            return {}
