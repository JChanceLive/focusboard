"""Read YouTube-Ops state.yaml files and produce pipeline status for FocusBoard."""

import yaml
from pathlib import Path

from config import YOUTUBE_OPS_PATH
from log import get_logger

logger = get_logger("pipeline")

# Channels to scan (directory name -> display code)
CHANNELS = {
    "channel-curator": "cc",
    "channel-pioneers": "pioneers",
    "channel-highestaura": "ha",
    "channel-zendo": "zendo",
}

# Stage field can vary: "stage" or "status" in different state.yaml files
RECORDING_READY_STAGES = {"recording_ready", "recorded", "editing", "published"}


def _read_state_yaml(path: Path) -> dict | None:
    """Read and parse a single state.yaml. Returns None on failure."""
    try:
        content = path.read_text(encoding="utf-8")
        return yaml.safe_load(content) or {}
    except (FileNotFoundError, PermissionError, yaml.YAMLError) as exc:
        logger.debug("Failed to read %s: %s", path, exc)
        return None


def _get_stage(data: dict) -> str:
    """Extract the stage/status from a state.yaml dict."""
    return data.get("stage") or data.get("status") or "unknown"


def _get_title(data: dict) -> str:
    """Extract video title from state.yaml."""
    return data.get("title") or ""


def _get_video_id(folder_name: str) -> str:
    """Extract video ID from folder name (e.g. 'CC-013-n8n-agent-builder' -> 'CC-013')."""
    parts = folder_name.split("-")
    if len(parts) >= 2:
        return f"{parts[0]}-{parts[1]}"
    return folder_name


def read_pipeline_state() -> dict:
    """Scan YouTube-Ops active folders and return pipeline summary.

    Returns {} on any failure so FocusBoard renders without pipeline data.
    """
    ops_path = YOUTUBE_OPS_PATH
    if not ops_path.exists():
        logger.warning("YouTube-Ops not found at %s", ops_path)
        return {}

    try:
        total_active = 0
        ready_to_record = 0
        by_stage = {}
        by_channel = {}
        next_to_record = []

        for channel_dir, code in CHANNELS.items():
            active_path = ops_path / channel_dir / "active"
            if not active_path.exists():
                continue

            channel_count = 0

            for video_dir in sorted(active_path.iterdir()):
                if not video_dir.is_dir() or video_dir.name.startswith("_"):
                    continue

                state_file = video_dir / "state.yaml"
                if not state_file.exists():
                    continue

                data = _read_state_yaml(state_file)
                if data is None:
                    continue

                stage = _get_stage(data)
                total_active += 1
                channel_count += 1

                # Count by stage
                by_stage[stage] = by_stage.get(stage, 0) + 1

                # Check if recording_ready
                if stage == "recording_ready":
                    ready_to_record += 1
                    video_id = _get_video_id(video_dir.name)
                    title = _get_title(data)
                    next_to_record.append({
                        "id": video_id,
                        "title": title,
                        "channel": code,
                    })

            by_channel[code] = channel_count

        # Sort next_to_record by ID for consistent ordering
        next_to_record.sort(key=lambda v: v["id"])

        return {
            "total_active": total_active,
            "ready_to_record": ready_to_record,
            "by_stage": by_stage,
            "by_channel": by_channel,
            "next_to_record": next_to_record[:5],  # Cap at 5 for display
        }

    except Exception as exc:
        logger.warning("Error reading pipeline state: %s", exc)
        return {}
