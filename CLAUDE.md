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

## Rules

- No build steps. Dashboard is vanilla HTML/CSS/JS.
- state.json is the ONLY data contract between Mac and Pi.
- If scp fails, Pi shows last known data + offline banner.
- Sequence > Time: current block = first unchecked, never auto-advance.
- json.dumps MUST use `ensure_ascii=True` — external data sources (Google Calendar, weather API) can contain surrogate characters that crash UTF-8 encoding. JavaScript handles `\uXXXX` escapes natively.
