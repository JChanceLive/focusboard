#!/usr/bin/env python3
"""
FocusBoard State Generator

Reads TODAY.md + supporting files from the Claude ecosystem and generates
a single state.json for the Raspberry Pi dashboard.

Usage:
    python3 generate_state.py              # Output to stdout
    python3 generate_state.py --output FILE  # Write to file
"""

import json
import sys
from datetime import datetime
from pathlib import Path

from config import (
    TODAY_PATH, FOCUS_PATH, KEYSTONES_PATH, PHILOSOPHY_PATH, VAULT_ACTIVE,
    DAILY_LOG_PATH, QUICK_WINS_PATH, SYNC_LOG_PATH,
    load_config,
)
from utils import read_file, get_quote
from parsers import (
    parse_day_overview, parse_block_tracker, parse_recording_ready,
    parse_done_today, parse_date_label, parse_focus, parse_keystones_yaml,
    extract_sop_tasks, match_keystones_to_blocks, parse_backlog_next,
    parse_task_counts, parse_daily_log, fetch_reminders, fetch_system_data,
)
from api import fetch_google_calendar, fetch_weather, fetch_keystone_streaks
from habits_reader import read_habits_state
from pipeline_reader import read_pipeline_state
from log import get_logger

logger = get_logger("main")


# ─── Calendar Icon Mapping ────────────────────────────────────────────────────

# Keyword -> icon mapping for calendar event titles
_ICON_MAP = [
    # Morning / Foundation
    ("morning", "\u2600"),       # ☀
    ("foundation", "\u2600"),
    ("rise", "\u2600"),
    # Creation / Recording
    ("creation", "\u270F"),      # ✏
    ("record", "\U0001F3A4"),    # 🎤
    ("batch", "\U0001F4E6"),     # 📦
    # Execution / Work
    ("execution", "\u26A1"),     # ⚡
    ("power hour", "\u26A1"),
    ("deep work", "\u26A1"),
    ("pro gear", "\u2699"),      # ⚙
    # Reset / Break
    ("reset", "\u23F8"),         # ⏸
    ("break", "\u23F8"),
    ("midday", "\u23F8"),
    # Health / Movement
    ("movement", "\U0001F3C3"),  # 🏃
    ("workout", "\U0001F4AA"),   # 💪
    ("health", "\u2764"),        # ❤
    # Family / Personal
    ("family", "\U0001F46A"),    # 👪
    ("dinner", "\U0001F37D"),    # 🍽
    # Evening / Wind-down
    ("evening", "\U0001F319"),   # 🌙
    ("wind", "\U0001F319"),
    ("night", "\U0001F319"),
    ("restore", "\U0001F319"),
    # System / Dev
    ("system", "\U0001F527"),    # 🔧
    ("dev", "\U0001F4BB"),       # 💻
    ("lab", "\U0001F52C"),       # 🔬
    # Research
    ("research", "\U0001F4DA"),  # 📚
    # Sacred / Protected
    ("sacred", "\u2728"),        # ✨
]


def _map_icon(title: str) -> str:
    """Map a calendar event title to an emoji icon via keyword lookup."""
    lower = title.lower()
    for keyword, icon in _ICON_MAP:
        if keyword in lower:
            return icon
    return "\U0001F4C5"  # 📅 default calendar icon


# ─── Calendar Now ─────────────────────────────────────────────────────────────

def _build_entry(event: dict, start, end, **extra) -> dict:
    """Build a calendar_now entry dict."""
    entry = {
        "title": event.get("title", ""),
        "icon": _map_icon(event.get("title", "")),
        "description": event.get("description", ""),
        "full_description": event.get("full_description", event.get("description", "")),
        "start": event.get("start", ""),
        "end": event.get("end", ""),
        "calendar_label": event.get("calendar_label", ""),
        "calendar_color": event.get("calendar_color", ""),
        "calendar_emoji": event.get("calendar_emoji", ""),
        "time_range": _format_time_range(start, end),
    }
    # Detect full-day timed events (23+ hours with dateTime fields)
    duration_hours = (end - start).total_seconds() / 3600
    if duration_hours >= 23:
        entry["all_day_timed"] = True
    entry.update(extra)
    return entry


def compute_calendar_now(calendar_events: list[dict], now: datetime) -> list[dict]:
    """Compute currently active calendar events based on wall-clock time.

    Returns active events (start <= now < end), or the next upcoming event
    with an 'upcoming' flag and 'starts_in_min' countdown if no active events.
    Skips all-day events. Full-day timed events (23+ hours) sorted last.
    """
    active = []
    upcoming = []

    for event in calendar_events:
        if event.get("all_day"):
            continue

        try:
            start = datetime.fromisoformat(event["start"])
            end = datetime.fromisoformat(event["end"])
        except (ValueError, KeyError):
            continue

        if start <= now < end:
            active.append(_build_entry(event, start, end))
        elif now >= end and (now - end).total_seconds() <= 300:
            # Event ended within last 5 min — show dimmed so hero doesn't go blank
            active.append(_build_entry(event, start, end, stale=True))
        elif start > now:
            upcoming.append((start, event))

    if active:
        # Sort: real timed events first, full-day timed events last
        active.sort(key=lambda e: (1 if e.get("all_day_timed") else 0))
        return active

    # No active events — find next upcoming
    if upcoming:
        upcoming.sort(key=lambda x: x[0])
        next_start, next_event = upcoming[0]
        try:
            end = datetime.fromisoformat(next_event["end"])
        except (ValueError, KeyError):
            end = next_start
        mins = max(0, round((next_start - now).total_seconds() / 60))
        return [_build_entry(next_event, next_start, end, upcoming=True, starts_in_min=mins)]

    return []


def _format_time_range(start: datetime, end: datetime) -> str:
    """Format a time range like '12:30 PM - 3:00 PM'."""
    fmt = "%-I:%M %p"
    return f"{start.strftime(fmt)} - {end.strftime(fmt)}"


# ─── Main ────────────────────────────────────────────────────────────────────

def generate_state() -> dict:
    """Generate the full state.json structure."""
    logger.info("Starting state generation")
    now = datetime.now().astimezone()

    # Read source files
    today_content = read_file(TODAY_PATH)
    focus_content = read_file(FOCUS_PATH)
    keystones_content = read_file(KEYSTONES_PATH)
    philosophy_content = read_file(PHILOSOPHY_PATH)

    # Load config for API calls
    config = load_config()

    # Parse backlog next item (independent of TODAY.md)
    tasks_path = VAULT_ACTIVE / "TASKS.md"
    backlog_next = parse_backlog_next(tasks_path)

    # Parse task counts and additional data sources
    task_counts = parse_task_counts(tasks_path, QUICK_WINS_PATH)
    daily_log = parse_daily_log(DAILY_LOG_PATH)
    reminders = fetch_reminders(config.get("reminders", {}).get("lists"))
    system_data = fetch_system_data(SYNC_LOG_PATH)

    # Read habits and pipeline data
    habits = read_habits_state()
    pipeline = read_pipeline_state()

    # Handle missing TODAY.md
    if not today_content:
        cal_events, cal_legend = fetch_google_calendar(config)
        calendar_now = compute_calendar_now(cal_events, now)
        return {
            "generated_at": now.isoformat(),
            "date": now.strftime("%Y-%m-%d"),
            "day_label": now.strftime("%a %b %-d"),
            "now": {"block": "", "task": "Waiting for schedule", "file": "", "source": ""},
            "blocks": [],
            "keystones": [],
            "sop_tasks": [],
            "done_today": [],
            "tomorrow_focus": parse_focus(focus_content) if focus_content else {
                "task": "", "action": "", "one_thing": "Not planned yet", "file": ""
            },
            "recording_ready": {"cc": 0, "pioneers": 0, "ha": 0, "zendo": 0, "total": 0},
            "backlog_next": backlog_next,
            "tasks": task_counts,
            "daily_log": daily_log,
            "reminders": reminders,
            "system": system_data,
            "habits": habits,
            "pipeline": pipeline,
            "quote": get_quote(philosophy_content),
            "calendar": cal_events,
            "calendar_legend": cal_legend,
            "calendar_now": calendar_now,
            "weather": fetch_weather(config),
            "meta": {
                "sync_version": 2,
                "no_schedule": True,
                "pipeline_active": pipeline.get("total_active", 0),
                "pipeline_rec_ready": pipeline.get("ready_to_record", 0),
            },
        }

    # Parse TODAY.md sections
    date_iso, day_label = parse_date_label(today_content)
    blocks = parse_day_overview(today_content)
    tracker = parse_block_tracker(today_content)
    recording_ready = parse_recording_ready(today_content)
    done_today = parse_done_today(today_content)

    # Apply block tracker state to blocks
    for block in blocks:
        if block["time"] in tracker:
            block["done"] = tracker[block["time"]]

    # Determine current block (first unchecked)
    current_block = None
    for block in blocks:
        if not block["done"]:
            block["is_current"] = True
            current_block = block
            break

    # Build now section
    # Clear field names: do = what to work on, from_ref = source file, duration = time
    # Legacy fields (task, file, source) kept for backwards compat with schedule.js
    if current_block:
        # Compute time range: start time from current block, end from next block
        current_idx = blocks.index(current_block)
        time_range = current_block["time"]
        if current_idx + 1 < len(blocks):
            time_range = current_block["time"] + " - " + blocks[current_idx + 1]["time"]

        now_section = {
            "block": current_block["block"],
            "do": current_block["file"],          # actual task description
            "from_ref": current_block["task"],     # source file/reference
            "duration": current_block["source"],   # time estimate
            "time_range": time_range,              # e.g., "6:00 - 7:05"
            "task": current_block["task"],
            "file": current_block["file"],
            "source": current_block["source"],
            "icon": current_block["icon"],
            "color": current_block["color"],
            "label": current_block["label"],
            "details": current_block["details"],
            "type": current_block["type"],
        }
    elif blocks:
        # All done
        now_section = {
            "block": "Day Complete",
            "do": "All blocks finished",
            "from_ref": "",
            "duration": "",
            "task": "All blocks finished",
            "file": "",
            "source": "",
            "icon": "\u2714",
            "color": "#2ecc71",
            "label": "COMPLETE",
            "details": [],
            "type": "health",
        }
    else:
        now_section = {
            "block": "",
            "do": "Waiting for schedule",
            "from_ref": "",
            "duration": "",
            "task": "Waiting for schedule",
            "file": "",
            "source": "",
            "icon": "\u25CC",
            "color": "#555555",
            "label": "WAITING",
            "details": [],
            "type": "work",
        }

    # Parse keystones and match to block completion
    keystones = parse_keystones_yaml(keystones_content) if keystones_content else []
    keystones = match_keystones_to_blocks(keystones, blocks)

    # Extract SOP tasks
    sop_tasks = extract_sop_tasks(blocks)

    # Parse tomorrow focus
    tomorrow_focus = parse_focus(focus_content) if focus_content else {
        "task": "", "action": "", "one_thing": "Not planned yet", "file": ""
    }

    # Get quote
    quote = get_quote(philosophy_content)

    # Fetch external data
    calendar_events, calendar_legend = fetch_google_calendar(config)
    calendar_now = compute_calendar_now(calendar_events, now)
    weather = fetch_weather(config)

    # Fetch keystone streaks from PiPulse API (enriches keystones in-place)
    fetch_keystone_streaks(keystones)

    # All blocks done?
    all_done = all(b["done"] for b in blocks) if blocks else False

    logger.info("State generated: %d blocks, %d keystones", len(blocks), len(keystones))
    return {
        "generated_at": now.isoformat(),
        "date": date_iso,
        "day_label": day_label,
        "now": now_section,
        "blocks": blocks,
        "keystones": keystones,
        "sop_tasks": sop_tasks,
        "done_today": done_today,
        "tomorrow_focus": tomorrow_focus,
        "recording_ready": recording_ready,
        "backlog_next": backlog_next,
        "tasks": task_counts,
        "daily_log": daily_log,
        "reminders": reminders,
        "system": system_data,
        "habits": habits,
        "pipeline": pipeline,
        "quote": quote,
        "calendar": calendar_events,
        "calendar_legend": calendar_legend,
        "calendar_now": calendar_now,
        "weather": weather,
        "meta": {
            "sync_version": 2,
            "no_schedule": len(blocks) == 0,
            "all_done": all_done,
            "pipeline_active": pipeline.get("total_active", 0),
            "pipeline_rec_ready": pipeline.get("ready_to_record", 0),
        },
    }


def main():
    state = generate_state()

    # Output destination
    output_path = None
    if "--output" in sys.argv:
        idx = sys.argv.index("--output")
        if idx + 1 < len(sys.argv):
            output_path = sys.argv[idx + 1]

    json_str = json.dumps(state, indent=2, ensure_ascii=True)

    if output_path:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        Path(output_path).write_text(json_str, encoding="utf-8")
    else:
        print(json_str)


if __name__ == "__main__":
    main()
