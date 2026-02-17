"""FocusBoard parsers for TODAY.md, keystones.yaml, and focus.md."""

import re
import shutil
import subprocess
import yaml
from datetime import datetime

from config import (
    BLOCK_TYPES, KEYSTONE_BLOCKS, SOP_PREFIXES,
    BLOCK_VISUALS, DEFAULT_VISUAL, BLOCK_DETAILS,
)
from log import get_logger

logger = get_logger("parsers")


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
                if file_ref in ("(no file)", "(browser)", "\u2014", "-"):
                    file_ref = ""

                visual = BLOCK_VISUALS.get(block_name, DEFAULT_VISUAL)
                block = {
                    "time": time_val,
                    "block": block_name,
                    "task": task,
                    "file": file_ref,
                    "source": source if source not in ("\u2014", "-") else "",
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
        logger.warning("Failed to parse keystones.yaml")
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


def parse_backlog_next(tasks_path) -> dict:
    """Parse TASKS.md for the first unchecked P1 or P2 task."""
    result = {"task": "", "priority": "", "time": "", "context": ""}
    try:
        content = tasks_path.read_text(encoding="utf-8")
    except (FileNotFoundError, PermissionError):
        return result

    for line in content.splitlines():
        stripped = line.strip()
        if not stripped.startswith("- [ ]"):
            continue

        # Match: - [ ] Task text [P1] (30m) #context @block
        match = re.match(
            r"- \[ \]\s+(.+?)\s+\[P([12])\]\s*(?:\((\w+)\))?\s*(?:#(\w+))?",
            stripped,
        )
        if match:
            result["task"] = match.group(1).strip()
            result["priority"] = "P" + match.group(2)
            result["time"] = match.group(3) or ""
            result["context"] = match.group(4) or ""
            break

    return result


def parse_task_counts(tasks_path, quick_wins_path) -> dict:
    """Parse TASKS.md for P1/P2 counts and QUICK-WINS.md for quick-win count."""
    result = {"p1_count": 0, "p2_count": 0, "quick_wins": 0, "top_p1": ""}

    # Parse TASKS.md
    try:
        content = tasks_path.read_text(encoding="utf-8")
    except (FileNotFoundError, PermissionError):
        content = ""

    for line in content.splitlines():
        stripped = line.strip()
        if not stripped.startswith("- [ ]"):
            continue
        if "[P1]" in stripped:
            result["p1_count"] += 1
            if not result["top_p1"]:
                # Extract task text before the [P1] tag
                match = re.match(r"- \[ \]\s+(.+?)\s+\[P1\]", stripped)
                if match:
                    result["top_p1"] = match.group(1).strip()
        elif "[P2]" in stripped:
            result["p2_count"] += 1

    # Parse QUICK-WINS.md
    try:
        qw_content = quick_wins_path.read_text(encoding="utf-8")
    except (FileNotFoundError, PermissionError):
        qw_content = ""

    in_available = False
    for line in qw_content.splitlines():
        stripped = line.strip()
        if stripped == "## Available":
            in_available = True
            continue
        if in_available and stripped.startswith("## "):
            break
        if in_available and stripped.startswith("- [ ]"):
            result["quick_wins"] += 1

    return result


def parse_daily_log(log_path) -> dict:
    """Parse daily LOG for wins (checked items) and blockers."""
    result = {"wins": [], "blockers": [], "entry_count": 0}

    try:
        content = log_path.read_text(encoding="utf-8")
    except (FileNotFoundError, PermissionError):
        return result

    for line in content.splitlines():
        stripped = line.strip()

        # Count checked items as wins
        if stripped.startswith("- [x]") or stripped.startswith("- [X]"):
            text = re.sub(r"^- \[[xX]\]\s*", "", stripped).strip()
            if text:
                result["wins"].append(text)
                result["entry_count"] += 1

        # Count unchecked items toward entry count
        elif stripped.startswith("- [ ]"):
            result["entry_count"] += 1

        # Blockers: list items containing BLOCKED, WAITING, or flagged
        if stripped.startswith("- ") and any(kw in stripped.upper() for kw in ("BLOCKED", "WAITING ON", "BLOCKER")):
            text = re.sub(r"^- \[[xX ]\]\s*", "", stripped).lstrip("- ").strip()
            if text and text not in result["blockers"] and not text.endswith(":"):
                result["blockers"].append(text)

    # Cap at 5 wins for display
    result["wins"] = result["wins"][:5]
    result["blockers"] = result["blockers"][:3]

    return result


def fetch_reminders(lists: list[str] | None = None) -> dict:
    """Fetch uncompleted reminders from Apple Reminders via osascript.

    Args:
        lists: List names to query (e.g. ["Groceries", "To-Do"]).
               If None, fetches from all lists.

    Returns:
        {"count": N, "items": [{"title": ..., "list": ..., "due": ...}, ...]}
    """
    result = {"count": 0, "items": []}

    if lists is None:
        lists = ["Reminders"]  # Default list

    for list_name in lists:
        script = f'''
        tell application "Reminders"
            try
                set theList to list "{list_name}"
                set output to ""
                repeat with r in (reminders of theList whose completed is false)
                    set rName to name of r
                    set rDue to ""
                    try
                        set rDue to (due date of r) as «class isot» as string
                    end try
                    set output to output & rName & "\\t" & rDue & "\\n"
                end repeat
                return output
            on error
                return ""
            end try
        end tell
        '''
        try:
            proc = subprocess.run(
                ["osascript", "-e", script],
                capture_output=True, text=True, timeout=10,
            )
            if proc.returncode != 0:
                logger.warning("Reminders fetch failed for '%s': %s", list_name, proc.stderr.strip())
                continue

            for line in proc.stdout.strip().splitlines():
                if not line.strip():
                    continue
                parts = line.split("\t", 1)
                title = parts[0].strip()
                due = parts[1].strip() if len(parts) > 1 else ""
                if title:
                    result["items"].append({
                        "title": title,
                        "list": list_name,
                        "due": due[:10] if due else "",  # YYYY-MM-DD
                    })
        except (subprocess.TimeoutExpired, FileNotFoundError, OSError) as exc:
            logger.warning("Reminders osascript failed: %s", exc)

    result["count"] = len(result["items"])
    # Cap at 8 items for display
    result["items"] = result["items"][:8]
    return result


def fetch_system_data(sync_log_path=None) -> dict:
    """Collect system health data: disk space and sync log status."""
    result = {"disk_free_pct": 100, "disk_warning": False, "sync_ok": True, "sync_age_min": 0}

    # Disk space
    try:
        usage = shutil.disk_usage("/")
        free_pct = round((usage.free / usage.total) * 100)
        result["disk_free_pct"] = free_pct
        result["disk_warning"] = free_pct < 10
    except OSError:
        pass

    # Sync log health
    if sync_log_path:
        try:
            import os
            stat = os.stat(sync_log_path)
            age_sec = datetime.now().timestamp() - stat.st_mtime
            result["sync_age_min"] = round(age_sec / 60)
            result["sync_ok"] = age_sec < 600  # < 10 min = healthy
        except (FileNotFoundError, OSError):
            result["sync_ok"] = False

    return result


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
