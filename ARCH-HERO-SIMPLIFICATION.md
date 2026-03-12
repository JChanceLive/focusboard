# ARCH: Hero Simplification

**Status:** DESIGN
**Date:** 2026-03-12
**Predecessor:** ARCH-HERO-REDESIGN.md (calendar-driven hero, deployed 2026-03-11)

---

## Problem

The hero redesign (Phase 2, 2026-03-11) introduced calendar-driven event display. When multiple calendars have overlapping events, ALL events stack vertically as full-size cards (title + time range + full description each). This creates visual clutter that defeats the original FocusBoard purpose: **a single glanceable answer to "What should I be doing right now?"**

## Design Principles

1. **One focus, one glance** -- The hero shows the single activity you should be doing NOW
2. **TODAY.md is primary** -- The sequence-based block from TODAY.md drives the hero
3. **Personal calendar is supplementary** -- Only Personal Google Calendar events appear in hero, as compact additions
4. **Max 2 items in hero** -- TODAY.md block (primary) + Personal calendar event (secondary)
5. **All other calendars excluded from hero** -- Dakboard etc. stay in bottom-right calendar list only
6. **All-day events excluded from hero** -- Shown in bottom-right calendar section only

---

## Hero Layout (New Design)

### Visual Spec

```
                     CENTER HERO
    ┌─────────────────────────────────────────┐
    │                                         │
    │   [icon]  Creation Stack                │  <- Icon LEFT of name (horizontal)
    │           10:00 AM - 12:30 PM           │  <- Time range
    │           2h 30m  ·  1h 15m left        │  <- Duration + time remaining
    │                                         │
    │           - Write Pioneers script       │  <- Description / sub-tasks
    │           - Review research notes       │  <- from TODAY.md block details
    │                                         │
    │           ⏱ 3 blocks behind schedule    │  <- Behind indicator (kept)
    │                                         │
    │   ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  │  <- Subtle divider
    │                                         │
    │   💳 Pay Bestbuy · 10:30 AM             │  <- Personal calendar event
    │                                         │  <- (in calendar color, compact)
    │                                         │
    └─────────────────────────────────────────┘
```

### Element Breakdown

#### 1. Primary: TODAY.md Current Block

| Element | Source | Style |
|---------|--------|-------|
| Icon | `blocks[current].icon` or `_map_icon()` | Left of name, same line, ~48-60px |
| Block name | `blocks[current].block` | Large text (~40-48px), block color |
| Time range | `blocks[current].time` + next block time | 18-20px, muted |
| Duration + remaining | Computed from block start/end times | 18-20px, muted |
| Sub-tasks / details | `blocks[current].details[]` | 16-18px, left-aligned, compact |
| Behind schedule | Computed (timePos - currentIdx) | Orange, bottom of primary section |

**Data source:** `state.blocks[]` (from TODAY.md Day Overview table, parsed by `generate_state.py`)

#### 2. Secondary: Personal Calendar Event (Optional)

| Element | Source | Style |
|---------|--------|-------|
| Icon | `_map_icon(event.title)` | Inline, small |
| Title | `event.title` | Calendar color, ~20-24px |
| Time | `event.time_range` or start time | Muted, inline after title |

**Data source:** `state.calendar_now[]` filtered to `calendar_label == "Personal"` only

**Visibility rules:**
- Only shown if a Personal calendar event is active NOW
- Hidden if no Personal calendar event overlaps current time
- All-day and all-day-timed events excluded
- Max 1 personal calendar event shown

#### 3. Removed from Hero

| Element | Where it goes |
|---------|---------------|
| Stacked calendar event cards | REMOVED entirely |
| Full descriptions from calendar events | Stay in bottom-right calendar list only |
| Non-Personal calendar events | Bottom-right calendar list only |
| Block mini chip (`#hero-block-chip`) | REMOVED (redundant -- block IS the hero now) |
| Large centered icon above name | REMOVED (icon moves left of name) |

---

## Bottom-Left Schedule Simplification

The schedule list currently shows multi-line descriptions/details for each block. Simplify:

### Current (verbose)
```
▶ 10:00  Creation Stack
         Write Pioneers script
         Review research notes
         Check analytics
```

### New (clean)
```
▶ 10:00  Creation Stack · Write Pioneers script
```

**Changes:**
- Collapse `details[]` into single-line summary (first detail only, or task name)
- Remove multi-line `s-details` expansion
- Keep: dot, icon, time, block name, task (inline)
- Keep: behind-schedule text below current item
- Keep: habit dots
- Keep: elapsed time ("started Xm ago")

---

## Backend Changes (generate_state.py)

### compute_calendar_now() Modifications

**Current:** Returns ALL active events from ALL calendars as `calendar_now[]` array.

**New:** Add a `hero_calendar_event` field to state that contains ONLY the single Personal calendar event (if any):

```python
# In build_state():
"hero_calendar_event": _get_hero_personal_event(calendar_now_entries),
```

```python
def _get_hero_personal_event(cal_now: list) -> dict | None:
    """Extract single Personal calendar event for hero display.

    Returns the first non-all-day Personal calendar event that is
    currently active (not upcoming, not stale, not all_day_timed).
    Returns None if no qualifying event.
    """
    for ev in cal_now:
        if ev.get("calendar_label") == "Personal":
            if ev.get("all_day_timed") or ev.get("upcoming") or ev.get("stale"):
                continue
            return ev
    return None
```

**`calendar_now[]` stays unchanged** -- still used by bottom-right calendar list for NOW badges.

### Block Duration + Time Remaining

Add computed fields to the current block in `state.now`:

```python
# In the now{} block computation:
"time_range": "10:00 AM - 12:30 PM",  # start time - next block start time
"duration_min": 150,                    # minutes in this block
"remaining_min": 75,                    # minutes until next block starts
```

These require knowing the NEXT block's start time to compute the current block's end time.

---

## Frontend Changes (render.js)

### renderCurrentBlock() Rewrite

Replace the current calendar-stack approach with:

1. Read `state.now` for block data (name, icon, time, details)
2. Read `state.hero_calendar_event` for optional Personal event
3. Render single unified hero layout:
   - Icon + Block name (horizontal row)
   - Time range + duration + remaining
   - Details (compact, from `state.now.details` or `state.blocks[current].details`)
   - Behind schedule indicator
   - Divider + Personal calendar one-liner (if present)

### Elements to Remove

- `#hero-cal-stack` -- no longer renders stacked cards
- `#hero-block-chip` -- redundant (block IS the hero)
- Large centered `#current-icon` above name -- icon moves inline left of name

### New DOM Structure

```html
<div id="current-block" class="current-block">
    <div id="date-label"></div>
    <div id="hero-clock"></div>

    <!-- Primary: TODAY.md block -->
    <div id="hero-primary">
        <div id="hero-title-row">
            <span id="hero-icon"></span>
            <span id="hero-block-name"></span>
        </div>
        <div id="hero-time-info"></div>
        <div id="hero-details"></div>
        <div id="hero-behind"></div>
    </div>

    <!-- Secondary: Personal calendar event (optional) -->
    <div id="hero-personal-event"></div>
</div>
```

---

## CSS Changes (style.css)

### New Hero Styles

```
#hero-title-row      -- flex row, align-items center, gap 16px
#hero-icon           -- 48-60px, block color, breathing glow (text-shadow)
#hero-block-name     -- 40-48px, block color
#hero-time-info      -- 18-20px, muted gray (#999)
#hero-details        -- 16-18px, left-aligned, max 3-4 lines
#hero-behind         -- orange (#e67e22), 16px
#hero-personal-event -- calendar color, 20-24px, preceded by subtle divider
```

### Breathing Glow (Preserved)

```css
#hero-icon {
    text-shadow: 0 0 40px color-mix(in srgb, var(--block-color) 40%, transparent);
    transition: color 0.5s ease;
}
```

### Removed Styles

- `.hero-cal-event`, `.hero-cal-title`, `.hero-cal-time`, `.hero-cal-desc`
- `.hero-cal-stale`, `.hero-cal-upcoming`, `.hero-cal-allday`
- `.hero-cal-chip`
- `.chip-icon`, `.chip-label`, `.chip-behind`

---

## Schedule List Simplification (schedule.js)

### Changes

- Remove multi-line `s-details` div expansion
- Show first detail inline after task name (separated by ` · `)
- Keep: habit dots, elapsed time, behind-schedule text, NOW marker

---

## Files to Modify

| File | Changes |
|------|---------|
| `mac/generate_state.py` | Add `hero_calendar_event`, add block duration/remaining to `now{}` |
| `pi/dashboard/render.js` | Rewrite hero rendering, remove calendar stack, new DOM structure |
| `pi/dashboard/style.css` | New hero styles, remove old calendar card styles |
| `pi/dashboard/schedule.js` | Simplify detail display to single-line |
| `pi/dashboard/index.html` | Update hero DOM structure |

## Files Unchanged

| File | Reason |
|------|--------|
| `mac/api.py` | Calendar fetch stays the same (all calendars still needed for list) |
| `pi/dashboard/calendar.js` | Bottom-right calendar list unchanged |
| `pi/dashboard/weather.js` | No changes |
| `pi/dashboard/clock.js` | No changes |

---

## Migration Notes

- `calendar_now[]` array stays in state.json (used by calendar list NOW badges)
- New `hero_calendar_event` field added (null when no Personal event active)
- Old hero DOM elements removed, new ones added -- full hero rewrite, not incremental
- No backward compatibility needed (single deployment target)

---

## Interview Decisions Log

| Q# | Question | Answer |
|----|----------|--------|
| Q1 | Calendar priority | Pull TODAY.md schedule data to center hero |
| Q2 | Data at a glance | Full name + icon (left of name), time-frame + length, description/sub-tasks, time remaining |
| Q3 | All-day events | Hide from hero. Show at top of bottom-right calendar section (already working) |
| Q4 | Breathing glow | Icon moves left of name (horizontal layout) |
| Q5 | Gap handling | Keep current behavior (next upcoming event with countdown) |
| Q6 | Data source | TODAY.md (primary) + Personal Google Calendar (secondary, in calendar color) |
| Q7 | Schedule list | Simplify -- reduce multi-line details, keep clean single-line |
| Q8 | Calendar colors | Already configured per calendar, use existing colors |
| Q9 | Behind schedule | Keep in hero |
| Q10 | Non-TODAY.md events | Personal calendar events show in hero as compact one-liner |
| Q11 | Visual hierarchy | TODAY.md block dominates top, Personal calendar event below as one-liner |
| Q12 | Which calendars in hero | Personal only. All others excluded from hero |
| Q13 | Multiple events | Max 2 in hero: 1 TODAY.md block + 1 Personal calendar event |
