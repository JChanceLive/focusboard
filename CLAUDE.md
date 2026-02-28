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

_Last updated: 2026-02-25 | 2 active memories, 2 total_

## Patterns & Conventions
- Pi project Git workflow applies to terminal ecosystem: gitignore standardization includes .mcp.json/.claude/ to preve... [git, terminal, pi-projects, ecosystem, workflow]

## Current Progress
- Terminal ecosystem gitignore cleanup campaign: Tier 1 (6 repos: auto-packager, fog-to-fire, pidash, piink, stardeck, ... [terminal, git, cleanup, batching]

_For deeper context, use memory_search, memory_related, or memory_ask tools._
<!-- MEMORY:END -->
