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
import os
import re
import sys
import yaml
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# ─── Paths ───────────────────────────────────────────────────────────────────

VAULT_ACTIVE = Path.home() / ".claude" / "claude-vault" / "_active"
TODAY_PATH = VAULT_ACTIVE / "TODAY.md"
FOCUS_PATH = Path.home() / ".claude" / "claude-vault" / "daily" / "focus.md"
KEYSTONES_PATH = Path.home() / ".claude" / "timekeeper" / "keystones.yaml"
PHILOSOPHY_PATH = Path.home() / ".claude" / "timekeeper" / "philosophy.md"

# Block type mapping derived from philosophy.md
BLOCK_TYPES = {
    "Morning Foundation": "health",
    "Creation": "work",
    "Creation Stack": "work",
    "Breakfast": "health",
    "Workout": "health",
    "Power Hour": "health",
    "DEV-1": "work",
    "DEV-2": "work",
    "DEV-3": "work",
    "Clean Mama": "health",
    "Midday Reset": "health",
    "EXEC-1": "work",
    "EXEC-2": "work",
    "EXEC-3": "work",
    "EXEC-4": "work",
    "BACKLOG": "work",
    "Research": "work",
    "LAB-1": "work",
    "LAB-2": "work",
    "LAB-3": "work",
    "PM Reflection": "work",
    "Family": "family",
    "Family Time": "family",
    "Night Restoration": "health",
    "Wind-Down": "health",
}

# Keystone-triggered blocks (required = true)
KEYSTONE_BLOCKS = {
    "Morning Foundation", "Creation", "Creation Stack",
    "Workout", "Power Hour",
    "DEV-1", "DEV-2", "DEV-3",
    "Midday Reset", "Clean Mama",
    "Family", "Family Time",
    "Night Restoration", "Wind-Down",
}

# SOP file indicators
SOP_PREFIXES = ("SOP-",)

# Per-block visual identity: icon (unicode), color (hex), label
BLOCK_VISUALS = {
    "Morning Foundation": {"icon": "\u2600", "color": "#f0a030", "label": "FOUNDATION"},  # ☀
    "Creation":          {"icon": "\u2726", "color": "#e84393", "label": "CREATION"},      # ✦
    "Creation Stack":    {"icon": "\u2726", "color": "#e84393", "label": "CREATION"},      # ✦
    "Breakfast":         {"icon": "\u2615", "color": "#a0a0a0", "label": "BREAKFAST"},     # ☕
    "Workout":           {"icon": "\u26A1", "color": "#00e676", "label": "POWER HOUR"},    # ⚡
    "Power Hour":        {"icon": "\u26A1", "color": "#00e676", "label": "POWER HOUR"},    # ⚡
    "DEV-1":             {"icon": "\u25C8", "color": "#00bcd4", "label": "DEVELOP"},        # ◈
    "DEV-2":             {"icon": "\u25C8", "color": "#00bcd4", "label": "DEVELOP"},        # ◈
    "DEV-3":             {"icon": "\u25C8", "color": "#00bcd4", "label": "DEVELOP"},        # ◈
    "Clean Mama":        {"icon": "\u2728", "color": "#81c784", "label": "CLEAN MAMA"},    # ✨
    "Midday Reset":      {"icon": "\u25CE", "color": "#81c784", "label": "RESET"},          # ◎
    "EXEC-1":            {"icon": "\u25B8", "color": "#ff9800", "label": "EXECUTE"},        # ▸
    "EXEC-2":            {"icon": "\u25B8", "color": "#ff9800", "label": "EXECUTE"},        # ▸
    "EXEC-3":            {"icon": "\u25B8", "color": "#ff9800", "label": "EXECUTE"},        # ▸
    "EXEC-4":            {"icon": "\u25B8", "color": "#ff9800", "label": "EXECUTE"},        # ▸
    "BACKLOG":           {"icon": "\u25A3", "color": "#78909c", "label": "BACKLOG"},        # ▣
    "Research":          {"icon": "\u25C9", "color": "#ab47bc", "label": "RESEARCH"},       # ◉
    "LAB-1":             {"icon": "\u2B22", "color": "#7c4dff", "label": "NIGHT LAB"},      # ⬢
    "LAB-2":             {"icon": "\u2B22", "color": "#7c4dff", "label": "NIGHT LAB"},      # ⬢
    "LAB-3":             {"icon": "\u2B22", "color": "#7c4dff", "label": "NIGHT LAB"},      # ⬢
    "PM Reflection":     {"icon": "\u25D0", "color": "#78909c", "label": "REFLECT"},        # ◐
    "Family":            {"icon": "\u2665", "color": "#ce93d8", "label": "FAMILY"},         # ♥
    "Family Time":       {"icon": "\u2665", "color": "#ce93d8", "label": "FAMILY"},         # ♥
    "Night Restoration": {"icon": "\u263E", "color": "#5c6bc0", "label": "RESTORE"},        # ☾
    "Wind-Down":         {"icon": "\u263E", "color": "#5c6bc0", "label": "RESTORE"},        # ☾
}

DEFAULT_VISUAL = {"icon": "\u25C6", "color": "#888888", "label": "FOCUS"}  # ◆

# Stack details: what each block contains (from philosophy.md)
BLOCK_DETAILS = {
    "Morning Foundation": ["Stretch", "Read + Coffee", "Journal", "Breathwork + Vision"],
    "Creation":           ["Walk (15 min)", "Pre-Record Skool (15 min)", "Deep Work (60 min)"],
    "Creation Stack":     ["Walk (15 min)", "Pre-Record Skool (15 min)", "Deep Work (60 min)"],
    "Workout":            ["Run w/ sprints", "Lift routine", "Cool-down", "Smoothie"],
    "Power Hour":         ["Run w/ sprints", "Lift routine", "Cool-down", "Smoothie"],
    "DEV-1":              ["JINTENT: Outreach, LinkedIn, client work"],
    "DEV-2":              ["Communities: 5 min x 4 brands"],
    "DEV-3":              ["Projects: Deep focus task"],
    "Clean Mama":         ["Rotating chore (25 min)", "Transition (5 min)"],
    "Midday Reset":       ["Lunch - mindful, no screens", "Class (optional)", "Nap ~1:30 PM", "Meditation"],
    "EXEC-1":             ["Daily editing touchpoint"],
    "EXEC-2":             ["Communities PM: second pass, Skool deep"],
    "EXEC-3":             ["Pipeline work, admin"],
    "EXEC-4":             ["Claude ecosystem improvements"],
    "BACKLOG":            ["Pull ONE item from High Priority", "Work it, check off"],
    "Research":           ["Watch Later: process 2-3 videos", "Extract golden nuggets"],
    "LAB-1":              ["Watch Later content processing"],
    "LAB-2":              ["Queue renders, exports"],
    "LAB-3":              ["Tech Sprint: micro-tasks"],
    "Family":             ["Transition (15 min)", "Dinner - present, no devices", "Connection time"],
    "Family Time":        ["Transition (15 min)", "Dinner - present, no devices", "Connection time"],
    "Night Restoration":  ["Gratitude journal", "Yoga Nidra / sleep transition", "Lights out 9 PM"],
    "Wind-Down":          ["Gratitude journal", "Yoga Nidra / sleep transition", "Lights out 9 PM"],
}


# ─── Parsing ─────────────────────────────────────────────────────────────────

def read_file(path: Path) -> Optional[str]:
    """Read file contents, return None if missing."""
    try:
        return path.read_text(encoding="utf-8")
    except (FileNotFoundError, PermissionError):
        return None


def parse_day_overview(content: str) -> list[dict]:
    """Parse the Day Overview markdown table into block dicts."""
    blocks = []
    in_table = False
    header_seen = False

    for line in content.splitlines():
        stripped = line.strip()

        # Detect table start
        if stripped.startswith("| Time") and "Block" in stripped:
            in_table = True
            continue

        # Skip separator row
        if in_table and stripped.startswith("|---"):
            header_seen = True
            continue

        # Parse data rows
        if in_table and header_seen and stripped.startswith("|"):
            cells = [c.strip() for c in stripped.split("|")]
            # Filter empty strings from split
            cells = [c for c in cells if c or cells.index(c) > 0]
            # cells: [time, block, file, task, source]
            if len(cells) >= 5:
                time_val = cells[0]
                block_name = cells[1]
                file_ref = cells[2]
                task = cells[3]
                source = cells[4]

                # Clean up file ref
                if file_ref in ("(no file)", "(browser)", "—", "-"):
                    file_ref = ""

                visual = BLOCK_VISUALS.get(block_name, DEFAULT_VISUAL)
                block = {
                    "time": time_val,
                    "block": block_name,
                    "task": task,
                    "file": file_ref,
                    "source": source if source not in ("—", "-") else "",
                    "done": False,
                    "is_current": False,
                    "type": get_block_type(block_name),
                    "required": is_required_block(block_name, file_ref),
                    "icon": visual["icon"],
                    "color": visual["color"],
                    "label": visual["label"],
                    "details": BLOCK_DETAILS.get(block_name, []),
                }
                blocks.append(block)

        # End of table
        elif in_table and header_seen and not stripped.startswith("|"):
            break

    return blocks


def parse_block_tracker(content: str) -> dict[str, bool]:
    """Parse Block Tracker checkboxes into {time: done} map."""
    tracker = {}
    in_tracker = False

    for line in content.splitlines():
        stripped = line.strip()

        if stripped == "## Block Tracker":
            in_tracker = True
            continue

        if in_tracker and stripped.startswith("## "):
            break

        if in_tracker and stripped.startswith("- ["):
            done = stripped.startswith("- [x]") or stripped.startswith("- [X]")
            # Extract time from "- [x] 6:30 Creation"
            match = re.match(r"- \[[xX ]\]\s+(\d{1,2}:\d{2})\s+", stripped)
            if match:
                tracker[match.group(1)] = done

    return tracker


def parse_recording_ready(content: str) -> dict:
    """Parse Recording Ready section."""
    result = {"cc": 0, "pioneers": 0, "ha": 0, "zendo": 0, "total": 0}

    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith("CC:") or "total)" in stripped:
            # Format: CC: 8 | Pioneers: 12 | HA: 7 | Zendo: 16 (43 total)
            match = re.search(r"CC:\s*(\d+)", stripped)
            if match:
                result["cc"] = int(match.group(1))
            match = re.search(r"Pioneers:\s*(\d+)", stripped)
            if match:
                result["pioneers"] = int(match.group(1))
            match = re.search(r"HA:\s*(\d+)", stripped)
            if match:
                result["ha"] = int(match.group(1))
            match = re.search(r"Zendo:\s*(\d+)", stripped)
            if match:
                result["zendo"] = int(match.group(1))
            match = re.search(r"\((\d+)\s+total\)", stripped)
            if match:
                result["total"] = int(match.group(1))
            break

    return result


def parse_done_today(content: str) -> list[str]:
    """Parse Done Today section items."""
    items = []
    in_done = False

    for line in content.splitlines():
        stripped = line.strip()

        if stripped == "## Done Today":
            in_done = True
            continue

        if in_done and stripped.startswith("## "):
            break

        if in_done and stripped.startswith("- ") and len(stripped) > 2:
            item = stripped[2:].strip()
            if item:
                items.append(item)

    return items


def parse_date_label(content: str) -> tuple[str, str]:
    """Parse date from TODAY.md header: '# TODAY | Fri Feb 7'."""
    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith("# TODAY"):
            # Extract date part after |
            match = re.search(r"\|\s*(.+)$", stripped)
            if match:
                label = match.group(1).strip()
                # Try to parse into ISO date
                now = datetime.now()
                try:
                    # Parse "Fri Feb 7" style
                    parsed = datetime.strptime(f"{label} {now.year}", "%a %b %d %Y")
                    return parsed.strftime("%Y-%m-%d"), label
                except ValueError:
                    return now.strftime("%Y-%m-%d"), label
    now = datetime.now()
    return now.strftime("%Y-%m-%d"), now.strftime("%a %b %-d")


def parse_focus(content: str) -> dict:
    """Parse focus.md for tomorrow's focus."""
    result = {
        "task": "",
        "action": "",
        "one_thing": "",
        "file": "",
    }

    if not content:
        return result

    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith("**Video:**"):
            result["task"] = stripped.replace("**Video:**", "").strip()
        elif stripped.startswith("**Action:**"):
            result["action"] = stripped.replace("**Action:**", "").strip()
        elif stripped.startswith("**File:**"):
            result["file"] = stripped.replace("**File:**", "").strip()

    # Parse "The ONE Thing" section
    in_one_thing = False
    for line in content.splitlines():
        stripped = line.strip()
        if "## The ONE Thing" in stripped:
            in_one_thing = True
            continue
        if in_one_thing and stripped.startswith("**") and stripped.endswith("**"):
            result["one_thing"] = stripped.strip("*").strip()
            break

    return result


def parse_keystones_yaml(content: str) -> list[dict]:
    """Parse keystones.yaml into keystone status list."""
    if not content:
        return []

    try:
        data = yaml.safe_load(content)
    except yaml.YAMLError:
        return []

    keystones_data = data.get("keystones", {})
    tracking = data.get("tracking", {})
    critical = set(tracking.get("critical_keystones", []))

    result = []
    for kid in sorted(keystones_data.keys()):
        ks = keystones_data[kid]
        result.append({
            "id": kid,
            "name": ks.get("name", kid),
            "done": False,  # Determined by block tracker matching
            "critical": kid in critical,
        })

    return result


def extract_sop_tasks(blocks: list[dict]) -> list[dict]:
    """Extract SOP tasks from blocks that reference SOP files."""
    sop_tasks = []
    for block in blocks:
        file_ref = block.get("file", "")
        if any(file_ref.startswith(prefix) for prefix in SOP_PREFIXES):
            sop_tasks.append({
                "name": block["task"],
                "done": block["done"],
                "block": block["block"],
            })
    return sop_tasks


def get_block_type(block_name: str) -> str:
    """Get block type from name."""
    return BLOCK_TYPES.get(block_name, "work")


def is_required_block(block_name: str, file_ref: str) -> bool:
    """Determine if a block is required (keystone-triggered or SOP)."""
    if block_name in KEYSTONE_BLOCKS:
        return True
    if any(file_ref.startswith(prefix) for prefix in SOP_PREFIXES):
        return True
    return False


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


def match_keystones_to_blocks(keystones: list[dict], blocks: list[dict]) -> list[dict]:
    """Mark keystones as done based on their triggered block being done."""
    # Map keystone trigger blocks to keystone IDs
    # K1 -> Morning Foundation, K2 -> Creation, K3 -> Workout, etc.
    trigger_map = {
        "K1": ["Morning Foundation"],
        "K2": ["Creation", "Creation Stack"],
        "K3": ["Workout", "Power Hour"],
        "K4": ["DEV-1"],
        "K5": ["Midday Reset", "Clean Mama"],
        "K6": ["Family", "Family Time"],
        "K7": ["Night Restoration", "Wind-Down"],
    }

    # Build lookup of done blocks
    done_blocks = set()
    for b in blocks:
        if b["done"]:
            done_blocks.add(b["block"])

    for ks in keystones:
        trigger_blocks = trigger_map.get(ks["id"], [])
        # Keystone is done if ANY of its triggered blocks is done
        ks["done"] = any(tb in done_blocks for tb in trigger_blocks)

    return keystones


# ─── Main ────────────────────────────────────────────────────────────────────

def generate_state() -> dict:
    """Generate the full state.json structure."""
    now = datetime.now().astimezone()

    # Read source files
    today_content = read_file(TODAY_PATH)
    focus_content = read_file(FOCUS_PATH)
    keystones_content = read_file(KEYSTONES_PATH)
    philosophy_content = read_file(PHILOSOPHY_PATH)

    # Handle missing TODAY.md
    if not today_content:
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
            "quote": get_quote(philosophy_content),
            "meta": {"sync_version": 1, "no_schedule": True},
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
    if current_block:
        now_section = {
            "block": current_block["block"],
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

    # All blocks done?
    all_done = all(b["done"] for b in blocks) if blocks else False

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
        "quote": quote,
        "meta": {
            "sync_version": 1,
            "no_schedule": len(blocks) == 0,
            "all_done": all_done,
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

    json_str = json.dumps(state, indent=2, ensure_ascii=False)

    if output_path:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        Path(output_path).write_text(json_str, encoding="utf-8")
    else:
        print(json_str)


if __name__ == "__main__":
    main()
