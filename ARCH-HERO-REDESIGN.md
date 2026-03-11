# FocusBoard Hero Redesign - Architecture Document

**Created:** 2026-03-11
**Status:** COMPLETE (deployed 2026-03-11)
**Scope:** Hero section, weather relocation, pipeline footer, schedule column enhancements

---

## Summary

Redesign the FocusBoard hero to show **real-time calendar events** (what's happening NOW by wall-clock time) instead of the sequence-based "current block" (first unchecked item from TODAY.md). Relocate weather to top-left, move pipeline stats to footer, and enhance the schedule column with block status context.

---

## Current vs. Proposed

| Area | Current | Proposed |
|------|---------|----------|
| **Hero title** | First unchecked block (e.g., "Morning Foundation" at 1:11 PM) | Current calendar event by time (e.g., "Midday Reset" at 1:11 PM) |
| **Hero description** | Task/file from TODAY.md block | Full Google Calendar event description |
| **Weather** | Inside hero section (above icon) | Floating top-left (replaces pipeline sidebar) |
| **Pipeline sidebar** | Floating top-left: "259 active / 253 rec" | Removed from sidebar, moved to sync footer |
| **Behind schedule** | Hero-only indicator | Schedule column banner + hero colored chip |
| **Current block** | Hero (large) | Schedule column banner (compact) + highlighted row |
| **Multiple calendars** | Only shown in bottom-right list | Stacked vertically in hero with calendar colors |

---

## Implementation Plan

### Phase 1: Backend Changes (generate_state.py)

#### 1A. Add `calendar_now` field to state.json

New top-level field computed in `generate_state.py`:

```python
"calendar_now": [
    {
        "title": "Midday Reset (SACRED)",
        "description": "Stack: Midday Reset (Weekdays only)\nTime: 12:30 PM...",
        "start": "2026-03-11T12:30:00-05:00",
        "end": "2026-03-11T15:00:00-05:00",
        "calendar_label": "Dakboard",
        "calendar_color": "#3498db",
        "calendar_emoji": "",
        "time_range": "12:30 PM - 3:00 PM"
    }
]
```

**Logic:** Filter `calendar` events where `now >= start AND now < end`. Return as array (supports overlapping events from multiple calendars). Sort by calendar priority or start time.

**When empty (gap between events):** Find the next upcoming event and return it with an `upcoming: true` flag and `starts_in_min: N` field.

```python
"calendar_now": [
    {
        "title": "EXECUTION",
        "description": "Stack: EXECUTION (WORK)...",
        "start": "2026-03-11T15:00:00-05:00",
        "end": "2026-03-11T16:30:00-05:00",
        "calendar_label": "Dakboard",
        "calendar_color": "#3498db",
        "upcoming": true,
        "starts_in_min": 23
    }
]
```

#### 1B. Keep `now` field unchanged

The sequence-based current block (`now.block`, `now.icon`, `now.color`, etc.) stays as-is. The schedule column and behind-schedule logic still depend on it. No breaking changes.

#### 1C. Add `pipeline_summary` to `meta` for footer

Move pipeline counts into `meta` for the sync footer:

```python
"meta": {
    "sync_version": 2,
    "no_schedule": false,
    "all_done": false,
    "pipeline_active": 259,
    "pipeline_rec_ready": 253
}
```

---

### Phase 2: Frontend Changes (pi/dashboard/)

#### 2A. Hero Section (render.js + index.html)

**New hero layout (top to bottom):**

1. ~~Weather~~ (removed from hero)
2. Date label (unchanged)
3. Clock (unchanged)
4. **Calendar event title** (large, colored by calendar) - replaces block name
5. **Calendar event time range** (sublabel) - e.g., "12:30 PM - 3:00 PM"
6. **Calendar event description** (full text, in hero card) - wraps/scrolls
7. If upcoming (gap): show "starts in X min" chip above title
8. **Stacked events:** If multiple calendars overlap, stack vertically with each event's calendar color as left-border accent
9. **Current Block mini-chip** (small colored chip): "Morning Foundation" with behind-schedule count - stays in hero as compact indicator
10. **Behind schedule chip** - redesigned as small colored chip (e.g., orange pill: "8 behind")

**Icon behavior:** Use the emoji from the TODAY.md block that maps to the current time period (lookup blocks by time match). If no block matches, use a generic calendar icon.

**When no events (upcoming mode):**
- Title shows next event name
- Sublabel shows "starts in 23 min"
- Description shows event description
- Slightly dimmed/muted styling to indicate "upcoming, not active"

#### 2B. Weather Relocation (weather.js + style.css)

- Remove `<div id="hero-weather">` rendering from hero
- New: Render weather in `#pipeline-sidebar` position (floating top-left, below header)
- Repurpose the existing `pipeline-sidebar` div or create a new `weather-sidebar` div
- Layout: Weather icon + temp on one line, feels-like/hi-lo on second line
- Compact styling (smaller than current hero weather)

#### 2C. Pipeline to Footer (pipeline-status.js + style.css)

- Remove pipeline sidebar rendering
- Add pipeline text to sync-status footer bar
- Format: Left side: `259 active | 253 rec` + sync dot/text on right
- Only show if `pipeline.total_active > 0`

#### 2D. Schedule Column Enhancement (schedule.js)

**Above schedule list - compact block status banner:**

```
> CURRENT: Morning Foundation     [8 behind]
```

- Shows the sequence-based current block name from `state.now.block`
- Shows behind-schedule count if applicable
- Uses `state.now.color` for accent
- Small font, single row, doesn't take much vertical space

**Existing schedule list - enhanced highlighting:**

- Current block row (`.schedule-item.current`) already highlighted
- Add the behind-schedule text below the highlighted current block row as a `.s-behind` element
- Format: "8 blocks behind schedule" in orange, indented under the current item

---

### Phase 3: CSS Changes (style.css)

#### 3A. New/Modified Classes

```css
/* Weather sidebar (replaces pipeline sidebar) */
.weather-sidebar { /* reuse .pipeline-sidebar position and z-index */ }

/* Hero calendar event stack */
.hero-cal-event { /* per-event card in hero with colored left border */ }
.hero-cal-title { /* large event title */ }
.hero-cal-time { /* time range sublabel */ }
.hero-cal-desc { /* full description, wrapped */ }
.hero-cal-upcoming { /* dimmed state for "starts in X min" */ }

/* Current block mini chip in hero */
.hero-block-chip { /* small pill: icon + "Morning Foundation" + "8 behind" */ }

/* Schedule column banner */
.schedule-banner { /* compact "CURRENT: Block Name [N behind]" */ }

/* Behind-schedule inline in schedule list */
.s-behind { /* orange text under current schedule item */ }

/* Pipeline in footer */
.sync-pipeline { /* left-aligned pipeline stats in sync bar */ }
```

#### 3B. Remove/Deprecate

- `.hero-weather` - no longer rendered in hero (could keep class for weather sidebar reuse)
- `.pipeline-sidebar` / `.pipe-stat` / `.pipe-val` / `.pipe-brand` - replaced by footer

---

## Data Flow Changes

```
Current:
  TODAY.md -> blocks -> first unchecked = hero title
  Google Calendar -> bottom-right list only

Proposed:
  TODAY.md -> blocks -> first unchecked = schedule banner + hero chip
  Google Calendar -> filter by NOW -> hero title + stacked events
  Google Calendar -> full list -> bottom-right (unchanged)
```

---

## File Change Summary

| File | Changes | Effort |
|------|---------|--------|
| `mac/generate_state.py` | Add `calendar_now` computation, add `pipeline_summary` to meta | Small |
| `pi/dashboard/render.js` | Rewrite `renderCurrentBlock()` to use `calendar_now`, add block chip | Medium |
| `pi/dashboard/weather.js` | Change target element from hero to sidebar position | Small |
| `pi/dashboard/pipeline-status.js` | Move rendering to sync footer bar | Small |
| `pi/dashboard/schedule.js` | Add banner above list, add behind-schedule under current item | Small |
| `pi/dashboard/style.css` | New classes for hero cal events, weather sidebar, footer pipeline, schedule banner | Medium |
| `pi/dashboard/index.html` | Add weather sidebar div, add schedule banner div, restructure hero | Small |

---

## Micro Upgrades (Recommended)

These are small, impactful improvements that pair well with the redesign:

### UI Improvements

1. **Hero event transition animation** - Fade between events when the calendar event changes (reuse existing `fadeHero()` pattern). ~5 lines of JS.

2. **Calendar event "now" indicator in bottom-right** - Add a small pulsing dot or "NOW" badge next to the event in the bottom-right calendar list that matches what's shown in the hero. Helps visually connect hero to calendar. ~10 lines of CSS + JS.

3. **Time-until-next in schedule** - For the current block row in the schedule, show "started Xm ago" in muted text. Gives a sense of elapsed time without cluttering. ~8 lines of JS.

### Backend Improvements

4. **Calendar event icon mapping** - In `generate_state.py`, map calendar event titles to icons using a simple keyword lookup (e.g., "Power Hour" -> lightning, "Family" -> heart, "Reset" -> pause). Reuse the existing block icon mapping from TODAY.md parser. ~15 lines Python.

5. **Cache `calendar_now` separately** - Currently the full calendar is cached 15 min. For hero accuracy, compute `calendar_now` from the cached calendar data on every state generation (no extra API calls, just a filter). Already happens if implemented correctly. ~0 extra lines.

6. **Stale event detection** - If `calendar_now` event ended more than 5 min ago (clock drift, stale cache), mark it `stale: true` so the UI can dim it slightly. Prevents showing "Midday Reset" at 3:10 PM. ~5 lines Python.

---

## Design Decisions (Q&A Record)

### Q1: Weather Position
**Q:** Where should weather go?
**A:** Replace pipeline sidebar (floating top-left under header where "259 active / 253 rec ready" currently sits).

### Q2: Pipeline/Recording-Ready Data
**Q:** Should pipeline data be removed or moved?
**A:** Move to sync status footer bar (bottom-left). Format: "259 active | 253 rec" compact text.

### Q3: Gap Between Calendar Events
**Q:** When no calendar event matches current time, what should hero show?
**A:** Next upcoming event with "starts in X min" countdown.

### Q4: Which Calendars in Hero
**Q:** Hero shows events from which calendar(s)?
**A:** All calendars, stacked vertically with different colors matching the bottom calendar legend. Dakboard schedule stack descriptions should be shown.

### Q5: Overlapping Events
**Q:** Multiple calendar events at same time?
**A:** Stack vertically in hero, each with their calendar color.

### Q6: Bottom-Right Calendar Column
**Q:** With hero now showing current events, what happens to bottom-right calendar?
**A:** Keep as-is. Hero highlights current; bottom-right still shows full upcoming list.

### Q7: Current Block (Sequence-Based) Location
**Q:** Where should "Morning Foundation" and "8 blocks behind" live?
**A:** Both: (1) Compact banner above schedule list, AND (3) Enhanced highlighting of current block row in schedule list with behind-schedule text below it.

### Q8: Calendar Event Description Length
**Q:** Truncate or show full event description?
**A:** Full description in the hero card area.

### Q9: Hero Icon
**Q:** With calendar events in hero, what should the large icon be?
**A:** Keep the block emoji from TODAY.md that maps to this time period.

### Q10: Behind Schedule Indicator
**Q:** Where should behind-schedule indicator live?
**A:** Both places: schedule column banner AND hero as a small colored chip.

---

## Implementation Sessions

**Session 1:** Backend changes — `calendar_now`, pipeline meta, `full_description`, stale fix (**DONE** `4407b86`)
**Session 2+3:** Frontend hero rewrite + weather sidebar + pipeline footer + schedule banner (**DONE** `e24b90d`)
**Session 4:** Micro upgrades — icon mapping, NOW badge, elapsed time, allday-timed, desc height (**DONE** `145b155`)
**Deploy:** Deployed to Pi, visually confirmed via override.json day mode (**DONE**)
