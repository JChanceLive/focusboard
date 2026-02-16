"""FocusBoard external API calls and streak tracking."""

import json
import requests
from datetime import datetime, timedelta

from config import OWM_ICON_MAP, STREAKS_PATH
from log import get_logger

logger = get_logger("api")


def fetch_google_calendar(config: dict) -> list[dict]:
    """Fetch upcoming events from Google Calendar REST API.

    Uses OAuth2 refresh token flow. Returns [] on any failure.
    """
    gc = config.get("google_calendar", {})
    client_id = gc.get("client_id", "")
    client_secret = gc.get("client_secret", "")
    refresh_token = gc.get("refresh_token", "")

    if not all([client_id, client_secret, refresh_token]):
        return []
    # Skip placeholder values
    if client_id == "FROM_ZSHRC":
        return []

    try:
        # Exchange refresh token for access token
        token_resp = requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
            timeout=10,
        )
        token_resp.raise_for_status()
        access_token = token_resp.json()["access_token"]

        # Fetch events: now through end of tomorrow
        now = datetime.now().astimezone()
        tomorrow_end = (now + timedelta(days=2)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )

        params = {
            "timeMin": now.isoformat(),
            "timeMax": tomorrow_end.isoformat(),
            "singleEvents": "true",
            "orderBy": "startTime",
            "maxResults": "20",
        }
        headers = {"Authorization": f"Bearer {access_token}"}

        events_resp = requests.get(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events",
            params=params,
            headers=headers,
            timeout=10,
        )
        events_resp.raise_for_status()

        events = []
        for item in events_resp.json().get("items", []):
            start = item.get("start", {})
            end = item.get("end", {})

            # All-day events use 'date', timed events use 'dateTime'
            all_day = "date" in start and "dateTime" not in start

            events.append({
                "title": item.get("summary", "(No title)"),
                "start": start.get("dateTime", start.get("date", "")),
                "end": end.get("dateTime", end.get("date", "")),
                "all_day": all_day,
                "location": item.get("location", ""),
            })

        return events

    except Exception as exc:
        logger.error("Google Calendar fetch failed: %s", exc)
        return []


def fetch_weather(config: dict) -> dict:
    """Fetch current weather from OpenWeatherMap. Returns {} on failure."""
    wc = config.get("weather", {})
    api_key = wc.get("api_key", "")
    zip_code = wc.get("zip", "34465")
    country = wc.get("country", "US")

    if not api_key or api_key == "SIGNUP_AT_OPENWEATHERMAP":
        return {}

    try:
        resp = requests.get(
            "https://api.openweathermap.org/data/2.5/weather",
            params={
                "zip": f"{zip_code},{country}",
                "units": "imperial",
                "appid": api_key,
            },
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()

        main = data.get("main", {})
        weather = data.get("weather", [{}])[0]
        icon_code = weather.get("icon", "01d")

        return {
            "temp": round(main.get("temp", 0)),
            "feels_like": round(main.get("feels_like", 0)),
            "high": round(main.get("temp_max", 0)),
            "low": round(main.get("temp_min", 0)),
            "condition": weather.get("main", ""),
            "description": weather.get("description", ""),
            "icon_char": OWM_ICON_MAP.get(icon_code, "\u2600"),
            "humidity": main.get("humidity", 0),
        }

    except Exception as exc:
        logger.error("Weather fetch failed: %s", exc)
        return {}


def load_and_update_streaks(keystones: list[dict], date_iso: str) -> None:
    """Load keystone streaks, update with today's data, enrich keystones in-place.

    Streak file format:
    {
        "daily_log": {"2026-02-11": {"K1": true, "K2": false, ...}, ...},
        "streaks": {"K1": {"current": 5, "best": 12}, ...}
    }
    """
    # Load or initialize
    try:
        streak_data = json.loads(STREAKS_PATH.read_text(encoding="utf-8"))
    except (FileNotFoundError, PermissionError, json.JSONDecodeError):
        streak_data = {"daily_log": {}, "streaks": {}}

    daily_log = streak_data.get("daily_log", {})
    streaks = streak_data.get("streaks", {})

    # Update today's entry
    today_entry = {}
    for ks in keystones:
        today_entry[ks["id"]] = ks.get("done", False)
    daily_log[date_iso] = today_entry

    # Prune to last 30 days
    if len(daily_log) > 30:
        sorted_dates = sorted(daily_log.keys())
        for old_date in sorted_dates[:-30]:
            del daily_log[old_date]

    # Calculate streaks per keystone
    sorted_dates = sorted(daily_log.keys(), reverse=True)
    for ks in keystones:
        kid = ks["id"]
        current_streak = 0
        for d in sorted_dates:
            if daily_log[d].get(kid, False):
                current_streak += 1
            else:
                break

        best = streaks.get(kid, {}).get("best", 0)
        if current_streak > best:
            best = current_streak

        streaks[kid] = {"current": current_streak, "best": best}

        # Enrich keystone dict in-place
        ks["streak"] = current_streak
        ks["best_streak"] = best

    # Write back
    streak_data["daily_log"] = daily_log
    streak_data["streaks"] = streaks

    try:
        STREAKS_PATH.parent.mkdir(parents=True, exist_ok=True)
        STREAKS_PATH.write_text(
            json.dumps(streak_data, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
    except (PermissionError, OSError):
        pass  # Non-critical, streaks just won't persist
