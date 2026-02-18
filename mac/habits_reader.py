"""Read habits.db (read-only) and produce habit state for FocusBoard."""

import json
import sqlite3
from datetime import date, datetime, timedelta

from config import HABITS_DB_PATH
from log import get_logger

logger = get_logger("habits")

# Day-of-week names matching habit-tracker date-utils.ts convention
_DAY_NAMES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def _is_available_today(schedule_days_json: str | None, today: date) -> bool:
    """Check if a habit is available today based on schedule_days JSON.

    Mirrors isAvailableToday() from habit-tracker/src/lib/date-utils.ts.
    Returns True if schedule_days is NULL (= every day).
    """
    if not schedule_days_json:
        return True
    try:
        days = json.loads(schedule_days_json)
    except (json.JSONDecodeError, TypeError):
        return True
    day_name = _DAY_NAMES[today.weekday()]
    return any(day_name.startswith(d) for d in days)

# Level thresholds duplicated from habit-tracker to avoid cross-project deps
LEVEL_THRESHOLDS = [
    (1, 0, "Beginner"),
    (2, 100, "Novice"),
    (3, 300, "Apprentice"),
    (4, 600, "Journeyman"),
    (5, 1000, "Adept"),
    (6, 1500, "Expert"),
    (7, 2100, "Master"),
    (8, 2800, "Grandmaster"),
    (9, 3600, "Legend"),
    (10, 4500, "Mythic"),
]


def _get_level_info(total_xp: int) -> tuple[int, str, int]:
    """Return (level, title, progress_pct) for given XP."""
    level, title, current_threshold = 1, "Beginner", 0
    next_threshold = 100

    for lvl, xp_req, lvl_title in reversed(LEVEL_THRESHOLDS):
        if total_xp >= xp_req:
            level = lvl
            title = lvl_title
            current_threshold = xp_req
            idx = LEVEL_THRESHOLDS.index((lvl, xp_req, lvl_title))
            next_threshold = LEVEL_THRESHOLDS[idx + 1][1] if idx + 1 < len(LEVEL_THRESHOLDS) else xp_req + 1000
            break

    if next_threshold > current_threshold:
        progress = round(((total_xp - current_threshold) / (next_threshold - current_threshold)) * 100)
    else:
        progress = 100

    return level, title, progress


def _open_db():
    """Open habits.db in read-only mode. Returns connection or None."""
    db_path = HABITS_DB_PATH
    if not db_path.exists():
        logger.warning("habits.db not found at %s", db_path)
        return None
    try:
        uri = f"file:{db_path}?mode=ro"
        conn = sqlite3.connect(uri, uri=True, timeout=3)
        conn.row_factory = sqlite3.Row
        return conn
    except sqlite3.Error as exc:
        logger.warning("Failed to open habits.db: %s", exc)
        return None


def read_habits_state() -> dict:
    """Read habits.db and return state dict for FocusBoard.

    Returns {} on any failure so FocusBoard renders without habits.
    """
    conn = _open_db()
    if conn is None:
        return {}

    try:
        today = date.today().isoformat()
        cur = conn.cursor()

        # --- Completion counts ---
        # Try daily_snapshots first (pre-computed)
        row = cur.execute(
            "SELECT completion_pct, completed_habits, total_habits FROM daily_snapshots WHERE date = ?",
            (today,),
        ).fetchone()

        if row:
            completion_pct = row["completion_pct"]
            completed = row["completed_habits"]
            total = row["total_habits"]
        else:
            # Fall back to counting directly
            total_row = cur.execute(
                "SELECT COUNT(*) as cnt FROM habits WHERE archived_at IS NULL"
            ).fetchone()
            total = total_row["cnt"] if total_row else 0

            comp_row = cur.execute(
                "SELECT COUNT(*) as cnt FROM completions WHERE date = ?", (today,)
            ).fetchone()
            completed = comp_row["cnt"] if comp_row else 0
            completion_pct = round((completed / total) * 100) if total > 0 else 0

        # --- XP / Level ---
        prog_row = cur.execute(
            "SELECT total_xp, current_level FROM user_progress WHERE id = 1"
        ).fetchone()
        total_xp = prog_row["total_xp"] if prog_row else 0
        level, level_title, level_progress = _get_level_info(total_xp)

        # --- Perfect day streak ---
        snapshots = cur.execute(
            "SELECT date, completion_pct FROM daily_snapshots ORDER BY date DESC LIMIT 90"
        ).fetchall()

        perfect_day_streak = 0
        expected = date.today()
        for snap in snapshots:
            if snap["date"] == expected.isoformat() and snap["completion_pct"] == 100:
                perfect_day_streak += 1
                expected -= timedelta(days=1)
            else:
                break

        # Best streak (from snapshots)
        best_streak = 0
        temp_streak = 0
        last_date = None
        sorted_snaps = sorted(snapshots, key=lambda s: s["date"])
        for snap in sorted_snaps:
            if snap["completion_pct"] == 100:
                snap_date = date.fromisoformat(snap["date"])
                if last_date and (snap_date - last_date).days == 1:
                    temp_streak += 1
                else:
                    temp_streak = 1
                best_streak = max(best_streak, temp_streak)
                last_date = snap_date
            else:
                temp_streak = 0
                last_date = None
        best_streak = max(best_streak, perfect_day_streak)

        # --- Habits grouped by tier (with streaks + completion timestamps) ---
        today_date = date.today()
        habits_rows = cur.execute("""
            SELECT h.id, h.name, h.emoji, h.tier_id, h.schedule_days,
                   t.name as tier_name, t.display_name as tier_display, t.sort_order,
                   CASE WHEN c.habit_id IS NOT NULL THEN 1 ELSE 0 END as done,
                   c.completed_at,
                   COALESCE(s.current_streak, 0) as current_streak
            FROM habits h
            JOIN tiers t ON h.tier_id = t.id
            LEFT JOIN completions c ON c.habit_id = h.id AND c.date = ?
            LEFT JOIN streaks s ON s.habit_id = h.id
            WHERE h.archived_at IS NULL
            ORDER BY t.sort_order, h.sort_order
        """, (today,)).fetchall()

        # Group by tier, filtering by schedule_days
        tiers_map = {}
        scheduled_completed = 0
        scheduled_total = 0
        for h in habits_rows:
            # Skip habits not scheduled for today
            if not _is_available_today(h["schedule_days"], today_date):
                continue

            tid = h["tier_id"]
            if tid not in tiers_map:
                tiers_map[tid] = {
                    "name": h["tier_display"] or h["tier_name"],
                    "sort_order": h["sort_order"],
                    "completed": 0,
                    "total": 0,
                    "habits": [],
                }
            tier = tiers_map[tid]
            is_done = bool(h["done"])
            tier["total"] += 1
            scheduled_total += 1
            if is_done:
                tier["completed"] += 1
                scheduled_completed += 1
            habit_entry = {
                "id": h["id"],
                "name": h["name"],
                "emoji": h["emoji"] or "",
                "done": is_done,
                "streak": h["current_streak"],
            }
            if h["completed_at"]:
                habit_entry["completed_at"] = h["completed_at"]
            tier["habits"].append(habit_entry)

        # Override totals with schedule-aware counts
        if not row:
            completed = scheduled_completed
            total = scheduled_total
            completion_pct = round((completed / total) * 100) if total > 0 else 0

        tiers = sorted(tiers_map.values(), key=lambda t: t["sort_order"])
        # Remove sort_order from output
        for t in tiers:
            del t["sort_order"]

        conn.close()

        return {
            "completed": completed,
            "total": total,
            "completion_pct": completion_pct,
            "xp": total_xp,
            "level": level,
            "level_title": level_title,
            "level_progress": level_progress,
            "perfect_day_streak": perfect_day_streak,
            "best_streak": best_streak,
            "tiers": tiers,
        }

    except Exception as exc:
        logger.warning("Error reading habits.db: %s", exc)
        try:
            conn.close()
        except Exception:
            pass
        return {}
