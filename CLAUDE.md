# FocusBoard - Raspberry Pi Wall-Mounted Focus Monitor

## Architecture

Mac generates `state.json` from TODAY.md + supporting files every 2 min via launchd.
SCP pushes to Pi. Pi runs Chromium kiosk displaying a vanilla HTML/CSS/JS dashboard.

```
Mac (generate_state.py) -> state.json -> scp -> Pi (Chromium kiosk)
```

## Key Files

| File | Purpose |
|------|---------|
| `mac/generate_state.py` | Reads TODAY.md, keystones.yaml, focus.md, philosophy.md -> state.json |
| `mac/generate-state.sh` | Shell wrapper: runs Python, scp to Pi |
| `mac/com.focusboard.sync.plist` | launchd job (2 min interval) |
| `pi/dashboard/` | HTML/CSS/JS dashboard (vanilla, no build) |
| `pi/config/focusboard.service` | systemd unit for Chromium kiosk |
| `deploy.sh` | Push dashboard updates to Pi via scp |

## Source Files Read

| File | What's Extracted |
|------|-----------------|
| `~/.claude/claude-vault/_active/TODAY.md` | Day Overview table, Block Tracker, Recording Ready, Done Today |
| `~/.claude/claude-vault/daily/focus.md` | Tomorrow's focus task |
| `~/.claude/timekeeper/keystones.yaml` | Keystone names, critical status |
| `~/.claude/timekeeper/philosophy.md` | Quote, block type info |

## state.json Output

Written to `~/.claude/pi/state.json` then scp'd to `focusboard:/home/jopi/focusboard/dashboard/state.json`

## Pi Connection

- **SSH alias:** `focusboard` (defined in `~/.ssh/config`)
- **IP:** `10.0.0.58` (static, on local network)
- **User:** `jopi`
- **MAC:** `b8:27:eb:57:6a:b7` (Raspberry Pi Foundation OUI)
- **mDNS:** `focusboard.local` does NOT resolve reliably — always use the SSH alias `focusboard` instead
- **Quick test:** `ssh focusboard "hostname"`
- **Deploy:** `./deploy.sh` (uses SSH alias, no env vars needed)
- Display: Portrait 1080x1920
- Chromium kiosk mode, auto-start via systemd
- nginx on port 8080 serves the dashboard

## Troubleshooting: "Mac Sync Offline"

### Key Auth Architecture (IMPORTANT)

The SSH config specifies `IdentityFile ~/.ssh/id_ed25519` for all Pi hosts.
The Pi's `authorized_keys` MUST contain that key (`josiah@focusboard`).

**History:** The Pi was originally set up with the `github_backup` key (`josiah@claude-backup`),
not `id_ed25519`. SSH worked anyway because the GitHub key was loaded in the agent
(via `AddKeysToAgent yes` on the github.com host), and SSH tries all agent keys.
After a Mac restart the agent was empty, and only `id_ed25519` was offered (per config) —
which the Pi didn't recognize. Fixed 2026-02-21 by adding `id_ed25519` to authorized_keys.

### Fixes Applied (2026-02-21)

1. **Added `id_ed25519` to Pi's authorized_keys** — the key the SSH config actually specifies
2. **Added `AddKeysToAgent yes` and `UseKeychain yes`** to all Pi hosts in `~/.ssh/config` — persists keys across Mac restarts

### If offline banner appears after restart:

1. Check SSH: `ssh focusboard "hostname"`
2. If "Permission denied (publickey)":
   - Re-add key to agent: `ssh-add --apple-use-keychain ~/.ssh/id_ed25519`
   - If still failing, re-push key to Pi: `ssh-copy-id -i ~/.ssh/id_ed25519.pub jopi@10.0.0.58` (requires Pi password)
3. Sync resumes automatically within 2 min (launchd job)

**Sync log:** `~/.claude/pi/sync.log` (last 100 entries, `OK:` = success, `WARN:` = failure)

## Rules

- No build steps. Dashboard is vanilla HTML/CSS/JS.
- state.json is the ONLY data contract between Mac and Pi.
- If scp fails, Pi shows last known data + offline banner.
- Sequence > Time: current block = first unchecked, never auto-advance.
- json.dumps MUST use `ensure_ascii=True` — external data sources (Google Calendar, weather API) can contain surrogate characters that crash UTF-8 encoding. JavaScript handles `\uXXXX` escapes natively.

<!-- MEMORY:START -->
# focusboard

_Last updated: 2026-03-12 | 25 active memories, 67 total_

## Key Decisions
- FocusBoard persistent journald logging requires removing Raspberry Pi OS drop-in override (/usr/lib/systemd/journald.... [focusboard, systemd, journald, logging, pi-os]
- FocusBoard visual review workflow uses multi-session pattern: backend changes (state generation, Git commits) complet... [focusboard, ui-review, workflow, multi-session]
- FocusBoard PiCam Live View shelved at S2 with explicit git tags (focusboard-picam-live-v1 for main branch state, pica... [focusboard, picam, git-workflow, shelving-strategy, hardware-dependent]
- FocusBoard hero simplification prioritizes TODAY.md as primary hero driver (single current block with duration/remain... [focusboard, hero-redesign, simplification, calendar-integration, ux]
- FocusBoard hero block name styling changed to always white (#ffffff) for clarity against any block color background; ... [focusboard, ui, hero-simplification, typography, color]

## Patterns & Conventions
- Pi project Git workflow applies to terminal ecosystem: gitignore standardization includes .mcp.json/.claude/ to preve... [git, terminal, pi-projects, ecosystem, workflow]
- FocusBoard keystones array in state.json is dynamically built from keystones.yaml keys (no hardcoded K1-K9); streaks ... [focusboard, state-management, json-contract]
- FocusBoard network watchdog implementation uses systemd timer (5-min interval) calling shell script that checks WiFi ... [focusboard, systemd, network-monitoring, watchdog]
- FocusBoard PiCam live view testing workflow: coordinate with user synchronously (ask user to watch display BEFORE run... [focusboard, picam, testing, workflow, coordination]
- Git preservation strategy for shelved features: tag both source and dependent repos before cleanup (e.g., git tag foc... [git, workflow, shelving, preservation, multi-repo]
- FocusBoard project documentation uses three-tier architecture: ARCH-PICAM-LIVE-VIEW.md (technical deep-dive with sess... [focusboard, documentation, project-structure, multi-file-coordination]
- FocusBoard PiCam daemon architecture uses signal-based control: SIGUSR1 spawns mpv overlay with 30-second auto-revert... [focusboard, picam, daemon, mpv, signal-handling, optimization, deployment]
- FocusBoard calendar-driven hero display pattern: event prioritization uses (not is_timed, not is_allday_timed, start_... [focusboard, calendar, event-sorting, state-generation, ui-pattern, time-display, css-layout]
- FocusBoard hero-calendar-event selection pattern filters Personal calendar to find first event within 24h with end_ti... [focusboard, calendar, hero-simplification, backend-selection, state-management]
- FocusBoard live countdown implementation splits computation between backend (block_duration in state.json, duration c... [focusboard, state-management, frontend-optimization, countdown, time-display]
- FocusBoard weather widget sizing follows 2x scale from original: icon/temp 52px (up from 26px), details 22px (up from... [focusboard, ui, css, weather-widget]

## Gotchas & Pitfalls
- launchd cron job (2-min interval) overwrites state.json while developer is testing locally; manual generate_state.py ... [focusboard, launchd, testing, timing]
- FocusBoard 'Sequence > Time' rule means current block is always first unchecked item (not based on wall-clock time), ... [focusboard, keystones, block-tracking, sequence-rule]
- Remote heredoc execution through SSH fails with zsh shell; working around by writing files locally (/tmp/network-watc... [focusboard, ssh, shell-scripting, deployment]
- FocusBoard motion daemon refresh signal (SIGUSR1) can be sent multiple times during a single motion event if motion >... [focusboard, picam, signal-handling, motion-detection, debugging]
- FocusBoard calendar hero state.json contract requires calendar_now object with current_event and next_event populated... [focusboard, state-management, json-contract, edge-cases]
- FocusBoard block time parsing must handle schedule wrap-around: '8:00' after '6:00 PM' means 8:00 PM (20:00), not 8:0... [focusboard, time-parsing, block-selection, state-generation]

## Current Progress
- FocusBoard Hero Simplification Phase 3 visual tuning COMPLETE (2026-03-12): block name styling finalized (white text,... [focusboard, hero-simplification, phase-3-complete, ui-tuning, deployment]
- FocusBoard PiCam Live View S2 SHELVED (2026-03-10): Session 2 optimization (snapshot pause + mpv reuse + grace timer)... [focusboard, picam, s2-complete, shelved, hardware-constraint, restoration-documented]

_For deeper context, use memory_search, memory_related, or memory_ask tools._
<!-- MEMORY:END -->
