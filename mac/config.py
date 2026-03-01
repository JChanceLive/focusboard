"""FocusBoard constants and configuration loading."""

import json
import logging
from pathlib import Path

# ─── Paths ───────────────────────────────────────────────────────────────────

VAULT_ACTIVE = Path.home() / ".claude" / "claude-vault" / "_active"
TODAY_PATH = VAULT_ACTIVE / "TODAY.md"
FOCUS_PATH = Path.home() / ".claude" / "claude-vault" / "daily" / "focus.md"
KEYSTONES_PATH = Path.home() / ".claude" / "timekeeper" / "keystones.yaml"
PHILOSOPHY_PATH = Path.home() / ".claude" / "timekeeper" / "philosophy.md"
CONFIG_PATH = Path.home() / ".claude" / "pi" / "focusboard-config.json"
STREAKS_PATH = Path.home() / ".claude" / "timekeeper" / "keystone_streaks.json"
DAILY_LOG_PATH = Path.home() / ".claude" / "daily" / "current.md"
QUICK_WINS_PATH = VAULT_ACTIVE / "QUICK-WINS.md"
SYNC_LOG_PATH = Path.home() / ".claude" / "pi" / "sync.log"
HABITS_API_URL = "http://10.0.0.103:5055/api/habits/state"
HABITS_API_CACHE = Path.home() / ".claude" / "pi" / "habits-api-cache.json"
YOUTUBE_OPS_PATH = Path.home() / "Documents" / "Projects" / "Claude" / "terminal" / "YouTube-Ops"

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
    "Morning Foundation",
    "Creation", "Creation Stack",
    "Workout", "Power Hour",
    "DEV-1", "DEV-2", "DEV-3",
    "EXEC-1", "EXEC-2", "EXEC-3", "EXEC-4",
    "LAB-1", "LAB-2", "LAB-3",
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

# OpenWeatherMap icon code -> Unicode weather symbol
OWM_ICON_MAP = {
    "01d": "\u2600",      # ☀ clear sky day
    "01n": "\u263E",      # ☾ clear sky night
    "02d": "\u26C5",      # ⛅ few clouds day
    "02n": "\u2601",      # ☁ few clouds night
    "03d": "\u2601",      # ☁ scattered clouds
    "03n": "\u2601",
    "04d": "\u2601",      # ☁ broken clouds
    "04n": "\u2601",
    "09d": "\uD83C\uDF27",  # 🌧 shower rain (surrogate pair, will be escaped)
    "09n": "\uD83C\uDF27",
    "10d": "\uD83C\uDF26",  # 🌦 rain day
    "10n": "\uD83C\uDF27",  # 🌧 rain night
    "11d": "\u26C8",      # ⛈ thunderstorm
    "11n": "\u26C8",
    "13d": "\u2744",      # ❄ snow
    "13n": "\u2744",
    "50d": "\uD83C\uDF2B",  # 🌫 mist
    "50n": "\uD83C\uDF2B",
}


def _validate_config(config: dict) -> None:
    """Log warnings for missing required config fields. Never raises."""
    logger = logging.getLogger("focusboard.config")

    checks = [
        ("google_calendar.client_id", config.get("google_calendar", {}).get("client_id")),
        ("google_calendar.client_secret", config.get("google_calendar", {}).get("client_secret")),
        ("google_calendar.refresh_token", config.get("google_calendar", {}).get("refresh_token")),
        ("weather.api_key", config.get("weather", {}).get("api_key")),
    ]

    placeholders = {"", "FROM_ZSHRC", "SIGNUP_AT_OPENWEATHERMAP"}

    for field, value in checks:
        if not value or value in placeholders:
            logger.warning("Config missing or placeholder: %s", field)


def load_config() -> dict:
    """Load focusboard-config.json, validate, return {} on failure."""
    try:
        config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except (FileNotFoundError, PermissionError, json.JSONDecodeError):
        return {}
    _validate_config(config)
    return config
