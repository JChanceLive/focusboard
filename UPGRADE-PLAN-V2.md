# FocusBoard V2 Upgrade Plan

**Created:** 2026-02-16
**Status:** DRAFT - Pending plan mode approval
**Sessions:** 9 (estimated)
**Project:** `~/Documents/Projects/Claude/terminal/focusboard/`

---

## Scope Summary

| Category | Items | Est. Time |
|----------|-------|-----------|
| Pre-flight + Audit | Pi arch check, rotation verify, baseline | 30m |
| Backend Light Cleanup | Split files, logging, caching | 1.5h |
| Multi-Calendar (3 calendars) | Config, backend fetch, frontend render | 2h |
| Phase 2 Features | 6 pending items from original plan | 3h |
| Additional Mac Data | Tasks, Reminders, LOG highlights, extras | 2h |
| UI/Visual Polish | Progress bar, transitions, auto-scroll | 1.5h |
| Camera Setup | MediaMTX, Tailscale, systemd, CSI config | 2h |
| Integration Testing | End-to-end, deploy, verify all features | 1h |
| **Total** | | **~13.5h across 9 sessions** |

---

## Pre-Session Checklist (COMPLETED 2026-02-16)

- [x] SSH into Pi: `ssh jopi@10.0.0.58` - CONNECTED
- [x] Check architecture: `uname -m` = **aarch64** (64-bit - camera is GO)
- [ ] Check portrait rotation: `wlr-randr` (still need to verify persists after reboot)
- [x] Check available RAM: **906MB total, 519MB available** (enough for camera + kiosk)
- [x] Check if CSI camera is connected: **YES - imx219 (Pi Camera Module v2) detected**
  - Sensor: IMX219 3280x2464 (8MP)
  - Modes: 640x480@103fps, 1920x1080@47fps, 3280x2464@21fps
  - `/dev/video0` present + rpicam-hello confirms detection
- [x] OS: Debian 13 (trixie) - confirmed
- [x] 64-bit confirmed - NO OS reinstall needed

---

## Session 1: Pre-Flight Audit + Backend Cleanup (Part 1)

**Goal:** Verify Pi state, split `generate_state.py` into modules

### Tasks

1. **Verify Pi architecture** (via SSH)
   - Run `uname -m` - must be `aarch64` for camera
   - If 32-bit: flag as blocker for camera sessions, rest of plan proceeds
   - Run `wlr-randr` to verify portrait rotation persistence

2. **Split `generate_state.py` (~600 lines) into modules**
   ```
   mac/
     generate_state.py    -> main entry point, ~50 lines
     parsers.py           -> parse_day_overview, parse_block_tracker, etc.
     api.py               -> fetch_google_calendar, fetch_weather
     config.py            -> BLOCK_VISUALS, BLOCK_TYPES, BLOCK_DETAILS constants
     utils.py             -> read_file, get_quote, helper functions
   ```
   - Keep `generate_state.py` as the entry point (launchd calls it)
   - Move constants to `config.py`
   - Move parsers to `parsers.py`
   - Move API calls to `api.py`
   - Move utilities to `utils.py`

3. **Add basic error logging**
   - Create `mac/log.py` with simple file logger
   - Log to `~/.claude/pi/focusboard.log` (rotate at 1MB)
   - Log API failures, parse errors, sync timing
   - Replace bare `except Exception: return []` with logged exceptions

### Deliverables
- [ ] Pi architecture confirmed
- [ ] `generate_state.py` split into 5 files
- [ ] Error logging working
- [ ] All existing tests still pass (manual: `python3 mac/generate_state.py`)

### Resume Info
```
Files modified: mac/generate_state.py, mac/parsers.py, mac/api.py, mac/config.py, mac/utils.py, mac/log.py
Test: python3 mac/generate_state.py | python3 -m json.tool
Deploy: ./deploy.sh (not needed - Mac-side only)
```

---

## Session 2: Backend Cleanup (Part 2) + Caching

**Goal:** Split `app.js`, add API caching, config validation

### Tasks

1. **Split `app.js` (~764 lines) into separate scripts**
   ```
   pi/dashboard/
     app.js               -> main init, polling, state management (~100 lines)
     clock.js             -> clock, night mode lifecycle, moon phase
     render.js            -> render functions (current block, day complete, waiting)
     schedule.js          -> schedule list rendering, time helpers
     calendar.js          -> calendar panel rendering
     weather.js           -> weather widget rendering
     keystones.js         -> keystone bar rendering
     counters.js          -> life counters
     background.js        -> background image rotation
     utils.js             -> esc(), formatTime(), shared helpers
   ```
   - No build step - just multiple `<script>` tags in `index.html`
   - Shared state via a global `FocusBoard` namespace object
   - Load order matters: utils first, then modules, then app.js last

2. **Add API response caching to `generate_state.py`**
   - Cache file: `~/.claude/pi/cache/weather.json` (TTL: 30 min)
   - Cache file: `~/.claude/pi/cache/calendar.json` (TTL: 15 min)
   - On cache hit: use cached data, skip API call
   - On cache miss or expired: fetch fresh, update cache
   - Benefit: Faster state generation, fewer API calls, works during brief network outages

3. **Add config validation**
   - Validate `focusboard-config.json` on load
   - Check required fields: `google_calendar.client_id`, `weather.api_key`
   - Log clear warnings for missing/placeholder values
   - Don't crash - just skip the feature and log why

### Deliverables
- [ ] `app.js` split into 10 files
- [ ] `index.html` updated with script tags
- [ ] API caching working (weather 30m, calendar 15m)
- [ ] Config validation with clear log messages
- [ ] Dashboard renders identically to before split

### Resume Info
```
Files modified: pi/dashboard/app.js (split), pi/dashboard/index.html, mac/api.py
Test: Deploy to Pi, verify dashboard renders correctly
Deploy: ./deploy.sh
```

---

## Session 3: Multi-Calendar Feature (Backend)

**Goal:** Fetch events from up to 3 Google Calendars, tag with source metadata

### Tasks

1. **Update `focusboard-config.json` schema**
   ```json
   {
     "google_calendar": {
       "client_id": "...",
       "client_secret": "...",
       "refresh_token": "...",
       "calendars": [
         {
           "id": "primary",
           "label": "Personal",
           "emoji": "\ud83d\udd35",
           "color": "#3498db"
         },
         {
           "id": "work@gmail.com",
           "label": "Work",
           "emoji": "\ud83d\udcbc",
           "color": "#ff9800"
         },
         {
           "id": "family@group.calendar.google.com",
           "label": "Family",
           "emoji": "\ud83d\udc9c",
           "color": "#9b59b6"
         }
       ]
     }
   }
   ```
   - Backward compatible: if `calendars` array missing, use `primary` with defaults
   - Up to 3 calendars supported

2. **Update `api.py` to fetch from multiple calendars**
   - Loop through `calendars` array
   - Fetch events from each calendar ID
   - Tag each event with `calendar_label`, `calendar_emoji`, `calendar_color`
   - Merge and sort all events by start time
   - Handle individual calendar failures gracefully (log, continue with others)

3. **Update `state.json` calendar event schema**
   ```json
   {
     "title": "Team Standup",
     "start": "2026-02-16T09:00:00-05:00",
     "end": "2026-02-16T09:30:00-05:00",
     "all_day": false,
     "location": "Zoom",
     "calendar_label": "Work",
     "calendar_emoji": "\ud83d\udcbc",
     "calendar_color": "#ff9800"
   }
   ```

4. **Add calendar legend to state.json**
   ```json
   {
     "calendar_legend": [
       {"label": "Personal", "emoji": "\ud83d\udd35", "color": "#3498db"},
       {"label": "Work", "emoji": "\ud83d\udcbc", "color": "#ff9800"},
       {"label": "Family", "emoji": "\ud83d\udc9c", "color": "#9b59b6"}
     ]
   }
   ```

### Deliverables
- [ ] Config schema updated with `calendars` array
- [ ] Multi-calendar fetch working in `api.py`
- [ ] Events tagged with source calendar metadata
- [ ] Legend data included in state.json
- [ ] Manual test: `python3 mac/generate_state.py | python3 -m json.tool`

### Resume Info
```
Files modified: mac/api.py, mac/generate_state.py
Config: ~/.claude/pi/focusboard-config.json (user must add calendar IDs)
Test: python3 mac/generate_state.py | python3 -m json.tool | grep calendar
```

---

## Session 4: Multi-Calendar Feature (Frontend)

**Goal:** Render multi-calendar events with color/emoji differentiation and legend

### Tasks

1. **Update `calendar.js` rendering**
   - Color-code event left border using `calendar_color`
   - Prefix event title with `calendar_emoji`
   - Font color for event title matches `calendar_color`
   - All-day events: use calendar color instead of hardcoded green

2. **Add calendar legend/key**
   - Small key at top of calendar column (below "CALENDAR" section title)
   - Format: `[emoji] Label` for each calendar, inline, separated by dots
   - Example: `🔵 Personal · 💼 Work · 💜 Family`
   - Style: smaller font, muted, non-intrusive

3. **Update CSS for multi-calendar**
   ```css
   .cal-event { border-left-color: var(--cal-color, var(--current)); }
   .cal-event .cal-title { color: var(--cal-color, var(--text-primary)); }
   .cal-legend { display: flex; gap: 12px; font-size: 11px; margin-bottom: 8px; }
   .cal-legend-item { display: flex; align-items: center; gap: 4px; }
   ```

4. **Backward compatibility**
   - If event has no `calendar_color`, fall back to current blue (`--current`)
   - If no legend data, hide the legend bar

### Deliverables
- [ ] Events visually differentiated by calendar source
- [ ] Legend/key displayed at top of calendar column
- [ ] Backward compatible with single-calendar state.json
- [ ] Looks good on 1050x1680 portrait display

### Resume Info
```
Files modified: pi/dashboard/calendar.js, pi/dashboard/style.css, pi/dashboard/index.html
Deploy: ./deploy.sh
Test: View on Pi or localhost:8080
```

---

## Session 5: Phase 2 Features (Part 1)

**Goal:** Done Today section, Quote rotation, Recording Ready counts

### Tasks

1. **Done Today section**
   - Add scrolling list below the schedule in bottom-left, or as a collapsible section
   - Data source: `state.json` already has `done_today[]` array
   - Style: checkmark + item text, muted green, compact
   - Auto-scroll if many items
   - Consider: show only last 5 items to avoid overwhelming the schedule

2. **Quote rotation from `quotes.json`**
   - Load `quotes.json` array on dashboard init
   - Rotate quote daily (hash date to index) or on each render cycle
   - Display in day-complete screen and/or night mode
   - Option: add quote to a thin bar at bottom of hero section during the day

3. **Recording Ready counts**
   - Data source: `state.json` already has `recording_ready` object
   - Display: small badge or row in bottom section
   - Format: `REC READY: CC:8 P:12 HA:7 Z:16 (43)`
   - Style: compact, uses brand colors, non-intrusive

### Deliverables
- [ ] Done Today items visible on dashboard
- [ ] Quotes rotate from quotes.json
- [ ] Recording Ready counts displayed
- [ ] All three features work with current state.json data

### Resume Info
```
Files modified: pi/dashboard/render.js, pi/dashboard/style.css, pi/dashboard/index.html
Data needed: Verify state.json has done_today and recording_ready populated
Deploy: ./deploy.sh
```

---

## Session 6: Phase 2 Features (Part 2)

**Goal:** BACKLOG Quick-Pull, Monitor power save schedule

### Tasks

1. **BACKLOG Quick-Pull display**
   - Show the next BACKLOG item from TASKS.md in a dedicated widget
   - Backend: parse `~/.claude/claude-vault/_active/TASKS.md` for first unchecked P1/P2 item
   - Add to state.json: `backlog_next: {task: "...", priority: "P1", time: "15m"}`
   - Frontend: small card in bottom section, subtle styling
   - Label: "NEXT UP" or "PULL" with the task text

2. **Monitor power save (blank 10pm-5am)**
   - Two approaches:
     - **A (Software):** Use `xset dpms` or `wlr-randr --off` via cron/systemd timer
     - **B (Dashboard):** CSS black screen with `display: none` on all content (builds on night mode)
   - Recommended: **Approach A** (actually turns off the monitor backlight, saves power, extends monitor life)
   - Systemd timer: `focusboard-power.timer` triggers at 10 PM and 5 AM
   - At 10 PM: `wlr-randr --output HDMI-A-1 --off`
   - At 5 AM: `wlr-randr --output HDMI-A-1 --on`

3. **Expand `quotes.json` content**
   - Add 50+ quotes relevant to focus, discipline, creativity
   - Categories: stoicism, productivity, creativity, family
   - Format: `[{"text": "...", "author": "..."}]`

### Deliverables
- [ ] BACKLOG Quick-Pull widget on dashboard
- [ ] Monitor power save working (10pm off, 5am on)
- [ ] quotes.json expanded with 50+ quotes
- [ ] Backend parses TASKS.md for next backlog item

### Resume Info
```
Files modified: mac/parsers.py (TASKS.md parser), mac/generate_state.py, pi/dashboard/render.js
Pi config: systemd timer for power save
Deploy: ./deploy.sh + SSH to Pi for timer install
```

---

## Session 7: Additional Mac Data Sources

**Goal:** Surface Tasks/Quick-Wins, Apple Reminders, Daily LOG highlights, and bonus data

### Tasks

1. **TASKS.md + QUICK-WINS.md integration**
   - Parse `~/.claude/claude-vault/_active/TASKS.md` for P1/P2 counts
   - Parse `~/.claude/claude-vault/_active/QUICK-WINS.md` for unchecked count
   - Add to state.json:
     ```json
     "tasks": {
       "p1_count": 3,
       "p2_count": 7,
       "quick_wins": 4,
       "top_p1": "Review video edits for CC-065"
     }
     ```
   - Frontend: small task summary widget in bottom section

2. **Apple Reminders integration**
   - Use `osascript` (AppleScript/JXA) to query Reminders app
   - Script: `mac/fetch_reminders.py` using `subprocess.run(["osascript", "-e", ...])`
   - Fetch: uncompleted reminders from specified lists (e.g., "Groceries", "To-Do")
   - Add to state.json:
     ```json
     "reminders": {
       "count": 5,
       "items": [
         {"title": "Buy diapers", "list": "Groceries", "due": "2026-02-17"},
         {"title": "Call dentist", "list": "To-Do", "due": null}
       ]
     }
     ```
   - Frontend: compact reminder list, grouped by list name
   - Note: Requires Reminders app permission grant on first run

3. **Daily LOG highlights**
   - Parse `~/.claude/daily/current.md` for today's entries
   - Extract: wins (lines with checkmarks), blockers (flagged items), summary stats
   - Add to state.json:
     ```json
     "daily_log": {
       "wins": ["Drafted CC-065", "Shipped picast v0.4.1"],
       "blockers": ["Waiting on thumbnail approval"],
       "entry_count": 12
     }
     ```
   - Frontend: wins as green checkmarks, blockers as orange flags

4. **Bonus data sources**
   - **Next recording** - Parse pipeline state.yaml files to find recording-ready videos
   - **Launchd job health** - Check if focusboard sync job ran successfully (parse sync.log)
   - **Disk space** - `df -h /` on Mac, report if < 10% free
   - **Git status** - Count of uncommitted repos in `~/Documents/Projects/Claude/terminal/`

### Deliverables
- [ ] Task counts + top P1 on dashboard
- [ ] Apple Reminders displayed (with permission)
- [ ] Daily LOG wins and blockers shown
- [ ] At least 2 bonus data sources working
- [ ] Dashboard layout still clean and readable

### Resume Info
```
Files modified: mac/parsers.py, mac/api.py (or new mac/system_data.py), mac/generate_state.py
New file: mac/fetch_reminders.py (AppleScript bridge)
Test: python3 mac/generate_state.py | python3 -m json.tool
```

---

## Session 8: UI/Visual Polish

**Goal:** Progress bar, transitions, auto-scroll, layout refinements

### Tasks

1. **Day completion progress bar**
   - Thin (4px) horizontal bar below the header
   - Width = % of blocks completed
   - Color: gradient from `--block-color` to `--done`
   - Animates smoothly as blocks are checked off
   - HTML: `<div class="progress-bar"><div class="progress-fill"></div></div>`

2. **Smooth block transitions**
   - When current block changes, animate icon + name + task with CSS fade
   - Use `transition: opacity 0.5s ease` on hero elements
   - Brief fade-out, update content, fade-in

3. **Schedule auto-scroll**
   - When schedule has many items, auto-scroll to keep current block visible
   - Use `scrollIntoView({ behavior: 'smooth', block: 'center' })` on current item
   - Only scroll if current item is not already in view

4. **Layout refinements**
   - Review spacing with all new widgets (tasks, reminders, recording ready)
   - Ensure bottom zone doesn't overflow with new content
   - Consider making bottom zone scrollable sections or tab-switchable panels
   - Test on actual 1050x1680 portrait resolution

5. **Final CSS audit**
   - Consistency check on font sizes, spacing, colors
   - Ensure all new elements follow the design system (var colors, font weights)
   - Verify night mode hides all new elements properly

### Deliverables
- [ ] Progress bar renders and animates
- [ ] Block transitions are smooth
- [ ] Schedule auto-scrolls to current
- [ ] All widgets fit cleanly in portrait layout
- [ ] Night mode handles all new elements

### Resume Info
```
Files modified: pi/dashboard/style.css, pi/dashboard/render.js, pi/dashboard/schedule.js, pi/dashboard/index.html
Deploy: ./deploy.sh
Test: View on Pi display
```

---

## Session 9: Camera Setup + Tailscale

**Goal:** CSI camera streaming via MediaMTX, remote viewing via Tailscale

### Pre-Requisites
- Pi must be 64-bit (`uname -m` = `aarch64`). If 32-bit, this session becomes "OS reinstall to 64-bit" instead.
- CSI camera physically connected to Pi

### Tasks

1. **Verify camera hardware**
   ```bash
   ssh jopi@10.0.0.58
   rpicam-hello --list-cameras    # Should detect CSI camera
   rpicam-still -o test.jpg       # Quick test capture
   ```
   - If not detected: check ribbon cable, enable camera in `raspi-config`
   - If 32-bit OS: must reinstall 64-bit Trixie (separate session)

2. **Install MediaMTX**
   ```bash
   # On Pi
   sudo apt install libfreetype6 libcamera0
   wget https://github.com/bluenviron/mediamtx/releases/latest/download/mediamtx_vX.X.X_linux_arm64v8.tar.gz
   tar xzvf mediamtx_*.tar.gz
   sudo mv mediamtx /usr/local/bin/
   sudo mv mediamtx.yml /etc/mediamtx.yml
   ```

3. **Configure MediaMTX**
   ```yaml
   # /etc/mediamtx.yml
   paths:
     cam:
       source: rpiCamera
       rpiCameraWidth: 1280
       rpiCameraHeight: 720
       rpiCameraFPS: 15
       rpiCameraBitrate: 1500000
   ```
   - 720p @ 15fps keeps CPU/RAM usage low alongside Chromium kiosk
   - Hardware H.264 encoding via VideoCore IV GPU

4. **Create systemd service for MediaMTX**
   ```ini
   # /etc/systemd/system/mediamtx.service
   [Unit]
   Description=MediaMTX Camera Streaming
   After=network.target

   [Service]
   ExecStart=/usr/local/bin/mediamtx /etc/mediamtx.yml
   Restart=on-failure
   RestartSec=5

   [Install]
   WantedBy=multi-user.target
   ```

5. **Install Tailscale on Pi**
   ```bash
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up
   ```
   - Authenticate via the URL provided
   - Note the Tailscale IP assigned to the Pi
   - Access camera from phone: `http://[tailscale-ip]:8889/cam`

6. **Install Tailscale on phone**
   - Download Tailscale app (iOS or Android)
   - Log in with same account
   - Open browser: `http://focusboard:8889/cam` (MagicDNS) or use Tailscale IP

7. **Resource monitoring**
   - After everything is running: `htop` on Pi
   - Check: total RAM usage < 700MB, CPU < 50% sustained
   - If tight: reduce camera to 480p or 10fps

### Deliverables
- [ ] CSI camera detected and capturing
- [ ] MediaMTX streaming at 720p
- [ ] Tailscale installed and connected
- [ ] Can view camera from phone outside the house
- [ ] Resource usage within budget (<700MB RAM)
- [ ] SystemD service auto-starts on boot

### Resume Info
```
Pi packages: mediamtx, tailscale
Config: /etc/mediamtx.yml, /etc/systemd/system/mediamtx.service
Test: http://[tailscale-ip]:8889/cam from phone
Fallback: If CSI fails, try USB webcam with ffmpeg source in mediamtx
```

---

## Future Sessions (Not In This Plan)

These are out of scope but documented for later:

- [ ] **Motion detection + clip recording** (Phase 2 of camera)
- [ ] **Brightness auto-dim via GPIO ambient sensor** (needs hardware purchase)
- [ ] **Camera feed embedded in dashboard** (small PiP window)
- [ ] **Push notifications** (Tailscale + webhook when motion detected)
- [ ] **Multi-Pi camera grid** (if adding cameras to other Pis)
- [ ] **Cloudflare Tunnel** (alternative to Tailscale for browser-only access)

---

## Session Handoff Protocol

Each session MUST:
1. Read this plan file at start
2. Read the previous session's savepoint (if any)
3. Complete all tasks for that session
4. Run tests (manual: generate state, deploy, verify on Pi)
5. Create a savepoint with:
   - Completed items
   - Next session number
   - Any blockers discovered
   - Modified files list
6. Commit changes to git with descriptive message

### Savepoint Format
```
~/.claude/savepoints/SESSION-SAVEPOINT-YYYY-MM-DD-focusboard-v2-sN.md
```
Where `sN` = session number (s1, s2, etc.)

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Pi is 32-bit (blocks camera) | ~~RESOLVED~~ | ~~High~~ | **Confirmed aarch64 - no risk** |
| CSI camera not detected | ~~RESOLVED~~ | ~~High~~ | **IMX219 detected and working** |
| Chromium + MediaMTX exceed 1GB RAM | Medium | Medium | Reduce camera resolution/FPS |
| Apple Reminders permission denied | Low | Low | Skip feature, use TASKS.md only |
| app.js split breaks dashboard | Low | High | Test each module incrementally |
| Multi-calendar fetch slows state generation | Low | Medium | Parallel fetch, aggressive caching |

---

## Dependencies

```
Session 1 ─> Session 2 ─> Session 3 ─> Session 4
                                          |
Session 5 (independent, can run in parallel with 3-4)
  |
Session 6
  |
Session 7 ─> Session 8 (polish depends on all widgets existing)

Session 1 (Pi arch check) ─> Session 9 (camera needs 64-bit confirmation)
```

**Parallelizable:** Sessions 5-6 can run independently from Sessions 3-4. Session 9 can run anytime after Session 1 confirms 64-bit.

---

*Plan generated by Claude Code on 2026-02-16. Enter plan mode in a fresh context window to refine and approve.*
