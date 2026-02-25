# FocusBoard Recording System - Architecture Document

**Date:** 2026-02-20
**Status:** RESEARCH COMPLETE - Ready for execution planning
**Project:** FocusBoard (Raspberry Pi 3 B+ camera + kiosk display)

---

## 1. Current System State

### Hardware
| Component | Detail |
|-----------|--------|
| Board | Raspberry Pi 3 B+ (1.4GHz quad-core ARM Cortex-A53, 1GB RAM) |
| Camera | IMX219 (Pi Camera Module v2) via CSI ribbon |
| OS | Debian 13 (trixie) / Raspberry Pi OS 64-bit (aarch64) |
| User | `jopi` |
| Hostname | `focusboard` |
| Local IP | 10.0.0.58 (static) |
| Tailscale IP | 100.112.178.125 |
| MagicDNS | focusboard.tail1c8112.ts.net |
| SSH alias | `focusboard` (in ~/.ssh/config) |

### Running Services
| Service | RAM | CPU | Notes |
|---------|-----|-----|-------|
| Chromium kiosk | ~300MB | Variable | FocusBoard display |
| MediaMTX v1.16.1 | ~50-100MB | ~10% | Camera streaming |
| OS + other | ~50MB | ~5% | Base system |
| **Total used** | **~443MB** | **~15%** | Of 906MB total |
| **Available** | **~463MB** | **~85%** | For recording system |

### MediaMTX Configuration
- Binary: `/usr/local/bin/mediamtx`
- Config: `/etc/mediamtx.yml`
- Service: `/etc/systemd/system/mediamtx.service`
- Stream URL: `rtsp://localhost:8554/cam`
- Resolution: 1280x720 @ 15fps
- Bitrate: 1.5 Mbps
- Codec: H.264 hardware encoding (VideoCore IV GPU)

### Access Points (already working)
- **Live stream (phone):** `http://100.112.178.125:8889/cam/` via Tailscale
- **SSH:** `ssh focusboard`

---

## 2. Requirements

### Must Have
1. **Continuous 24/7 recording** to external storage
2. **Motion detection** that marks timestamps in the continuous recordings
3. **Web UI** to browse recordings with motion event timeline/markers
4. **30-day retention** with automatic cleanup
5. **Auto-start** on boot, self-healing if services crash

### Nice to Have
- Browse/playback from Mac via Tailscale (web UI accessible remotely)
- Phone used primarily for live feed (already working)
- Notification when motion detected (future enhancement)

### Constraints
- Pi 3 B+ has only ~463MB free RAM
- USB 2.0 only (shared bus with Ethernet)
- Must coexist with existing kiosk + MediaMTX

---

## 3. Architecture Decision: DIY NVR Stack

### Why Not Off-the-Shelf NVR Software

| Software | Min RAM | Why Not |
|----------|---------|---------|
| Frigate | 4GB+ | Needs Coral TPU, TFLite unusable on Pi 3 CPU |
| ZoneMinder | 2GB+ | Full LAMP stack (MySQL + Apache + PHP) |
| Shinobi | 500MB+ | Node.js + MySQL + FFmpeg = too heavy |
| Viseron | 500MB+ | Python + OpenCV + TFLite = too heavy |
| motionEye | 150-230MB | Usable, but UI doesn't support continuous + markers |

### Chosen Architecture: ffmpeg + motion + Custom Web UI

```
MediaMTX (rtsp://localhost:8554/cam)
    |
    +---> ffmpeg (-c copy) ---> 5-min MP4 segments ---> /mnt/recordings/YYYY-MM-DD/
    |                                                         |
    +---> motion daemon ----> event callbacks ----> SQLite DB  |
                                                       |       |
                                                       v       v
                                              Lightweight web server (Go or Flask)
                                                       |
                                                       v
                                              Browser: Timeline + Video player
                                              (accessible via Tailscale from Mac)
```

### Resource Budget

| Component | RAM | CPU | Notes |
|-----------|-----|-----|-------|
| ffmpeg (-c copy) | ~30MB | <10% | Remux only, no transcoding |
| motion daemon | ~20MB | 50-80% of 1 core | Main CPU cost |
| SQLite + logger | ~5MB | Negligible | Runs briefly per event |
| Web server (Go) | ~15-30MB | <5% | Serves UI + API |
| **NVR total** | **~70-85MB** | **~25-35% total** | |
| **System total** | **~520-530MB** | **~50%** | Well within limits |
| **Remaining** | **~380MB** | **~50%** | Healthy headroom |

---

## 4. Storage Architecture

### Storage Math (1.5 Mbps, 720p 15fps H.264)

| Period | Storage Required |
|--------|-----------------|
| Per hour | 0.675 GB |
| Per day | 16.2 GB |
| Per week | 113.4 GB |
| Per 30 days | **486 GB** |

### Decision: 1TB External Storage

A 1TB drive provides:
- 30 days of continuous recording: ~486 GB
- 10% reserved space for system: ~100 GB
- Buffer for bitrate spikes: ~400 GB headroom
- Room to increase retention if desired

### Storage Hardware Options

#### Option A: USB SSD (RECOMMENDED)
- **Power:** 300-700mA active, safe to power directly from Pi 3 B+ USB
- **Reliability:** No moving parts, silent, shock resistant
- **Examples:** Samsung T7 1TB (~$80), Crucial X6 1TB (~$65), SanDisk Extreme 1TB (~$75)
- **Power supply:** Pi's existing PSU should work if 3A; add powered USB hub for extra safety

#### Option B: Self-Powered External HDD (VIABLE)
- **Power:** Has its own AC adapter, eliminates all power concerns
- **Reliability:** Mechanical, but external power = very stable operation
- **Cost:** Cheapest per TB
- **Note:** User already has a self-powered HDD available

#### Option C: Bus-Powered 2.5" USB HDD (RISKY)
- **Power:** Spin-up draws 700mA-1.2A, can cause Pi brownouts
- **Risk:** Disconnects, corruption, unexpected reboots
- **Mitigation:** Requires powered USB hub ($25-35)

### Decision: User Choice Between Option A and B
- If using the self-powered HDD already on hand: **Option B** (free, reliable)
- If buying new: **Option A** (USB SSD, cleaner setup)

### Filesystem & Mount
- **Filesystem:** ext4 (mature, journaled, fast on Linux)
- **Mount options:** `defaults,noatime,nofail,commit=60`
- **Mount point:** `/mnt/recordings`
- **Auto-mount:** via `/etc/fstab` with UUID

### File Organization
```
/mnt/recordings/
  2026-02-20/
    00-00.mp4   (12:00 AM - 12:05 AM)
    00-05.mp4   (12:05 AM - 12:10 AM)
    ...
    23-55.mp4   (11:55 PM - 12:00 AM)
  2026-02-21/
    ...
```

- **Segment duration:** 5 minutes
- **Naming:** `HH-MM.mp4` (hour-minute of segment start)
- **Directory:** `YYYY-MM-DD/` per day
- **Benefits:** Power-loss resilient (max 5 min lost), easy browsing, simple cleanup

---

## 5. Recording Implementation

### Option A: MediaMTX Native Recording (SIMPLEST)

MediaMTX has built-in recording support. Add to `/etc/mediamtx.yml`:

```yaml
paths:
  cam:
    source: rpiCamera
    rpiCameraWidth: 1280
    rpiCameraHeight: 720
    rpiCameraFPS: 15
    rpiCameraBitrate: 1500000
    record: yes
    recordPath: /mnt/recordings/%path/%Y-%m-%d/%H-%M-%S
    recordFormat: fmp4
    recordSegmentDuration: 5m
```

**Pros:** Zero additional processes, no extra CPU/RAM, built into existing service
**Cons:** Less control over segment naming, tied to MediaMTX version features

### Option B: ffmpeg RTSP Remux (MORE CONTROL)

```bash
ffmpeg -i rtsp://localhost:8554/cam \
       -c copy \
       -map 0 \
       -f segment \
       -segment_time 300 \
       -segment_format mp4 \
       -reset_timestamps 1 \
       -strftime 1 \
       "/mnt/recordings/%Y-%m-%d/%H-%M.mp4"
```

Run as systemd service with `Restart=always`.

**Pros:** Full control over output, well-documented, battle-tested
**Cons:** Extra process (~30MB RAM), needs reconnection handling

### Decision: Try MediaMTX Native First

MediaMTX native recording is the simplest path with zero additional resource cost. Fall back to ffmpeg if native recording has issues with segment naming, reliability, or format compatibility.

---

## 6. Motion Detection Implementation

### motion daemon (C-based, lightweight)

Install: `sudo apt install motion`

Configuration (`/etc/motion/motion.conf`):
```ini
daemon on
process_id_file /var/run/motion/motion.pid

# Input: consume RTSP from MediaMTX
netcam_url rtsp://localhost:8554/cam
netcam_keepalive on

# Disable ALL file/stream output (recording handled separately)
stream_port 0
ffmpeg_output_movies off
output_pictures off
snapshot_interval 0
target_dir /dev/null

# Detection parameters (tunable)
motion_detection on
minimum_motion_frames 3
threshold 1500
event_gap 10
locate_motion_mode off

# Event hooks -> Python script -> SQLite
on_event_start /usr/local/bin/log_motion_event.py start %t
on_event_end /usr/local/bin/log_motion_event.py end %t
```

### CPU Optimization Strategies
1. **Lower-res sub-stream:** If we configure MediaMTX to provide a second stream at 360p for motion analysis, CPU drops from 50-80% to ~15-25% of one core
2. **Reduce detection framerate:** Process every 3rd frame instead of every frame
3. **Adjust threshold:** Higher threshold = less false positives = less processing
4. **Alternative:** Use ffmpeg scene detection instead of motion daemon (lighter but less configurable)

### Motion Event Logger (Python + SQLite)

Tiny Python script triggered by motion daemon callbacks:
- Receives start/end timestamps
- Logs to SQLite database
- Maps timestamps to the correct recording segment file
- RAM: Negligible (runs briefly per event)

---

## 7. Web UI for Browsing Recordings

### Architecture
- **Backend:** Lightweight Go HTTP server OR Python Flask/FastAPI
  - Go preferred: ~15MB RAM, single binary, no dependencies
  - Flask fallback: ~40-60MB RAM, needs Python runtime
- **Frontend:** Static HTML/CSS/JS (no framework needed)
- **Database:** SQLite (motion_events table)
- **Port:** 8890 (next available after MediaMTX's 8889)
- **Access:** `http://focusboard.tail1c8112.ts.net:8890/` from Mac via Tailscale

### UI Features
1. **Date picker** - Select date to view
2. **24-hour timeline** - Visual bar showing the full day
3. **Motion markers** - Highlighted regions on timeline where motion was detected
4. **Video player** - HTML5 `<video>` tag, loads correct segment
5. **Click-to-seek** - Click timeline marker -> loads segment + seeks to timestamp
6. **File browser** - Simple list of available dates/segments as fallback

### Video Serving
- Serve MP4 segments directly from `/mnt/recordings/` via the web server
- HTTP range requests for seeking within segments
- No transcoding needed - browser can play H.264 MP4 natively

---

## 8. Auto-Cleanup (30-Day Retention)

### Hybrid Strategy: Age-Based + Space-Based Failsafe

**Primary:** Delete recordings older than 30 days
**Failsafe:** If disk usage exceeds 90%, delete oldest until below 85%

### Implementation: systemd Timer + Cleanup Script

```bash
#!/bin/bash
# /usr/local/bin/cleanup_recordings.sh
RECORDING_DIR="/mnt/recordings"
RETENTION_DAYS=30
MAX_USAGE_PERCENT=90
TARGET_USAGE_PERCENT=85

# 1. Age-based cleanup
find "$RECORDING_DIR" -type f -name "*.mp4" -mtime +$RETENTION_DAYS -delete
find "$RECORDING_DIR" -type d -empty -delete

# 2. Space-based failsafe
USAGE=$(df "$RECORDING_DIR" | awk 'NR==2 {print $5}' | tr -d '%')
while [ "$USAGE" -gt "$MAX_USAGE_PERCENT" ]; do
    OLDEST=$(find "$RECORDING_DIR" -type f -name "*.mp4" -printf '%T@ %p\n' | sort -n | head -1 | awk '{print $2}')
    [ -z "$OLDEST" ] && break
    rm "$OLDEST"
    USAGE=$(df "$RECORDING_DIR" | awk 'NR==2 {print $5}' | tr -d '%')
done

# 3. Clean old motion events from database
sqlite3 /var/lib/nvr/motion_events.db \
    "DELETE FROM motion_events WHERE timestamp < datetime('now', '-$RETENTION_DAYS days');"
```

Run daily at 2 AM via systemd timer.

### SQLite Database Cleanup
- Delete motion event entries older than 30 days (matching video cleanup)
- VACUUM periodically to reclaim space

---

## 9. System Reliability

### SD Card Protection
- **NEVER** record video to the SD card
- Install `log2ram` to redirect `/var/log` to tmpfs (reduces SD writes dramatically)
- All video goes to external USB storage
- Consider `noatime` on root mount to further reduce writes

### Power Loss Recovery
- 5-minute segments: max data loss = 5 minutes of footage
- ext4 journaling: filesystem recovers cleanly after unclean shutdown
- systemd `Restart=always` on all services: auto-recovery

### Service Dependencies (boot order)
```
network.target
    -> mediamtx.service (camera streaming)
        -> mnt-recordings.mount (USB drive)
            -> ffmpeg-record.service OR mediamtx handles recording
            -> motion.service (motion detection)
            -> nvr-webui.service (web interface)
```

### Monitoring
- `vcgencmd measure_temp` - CPU temperature (target: <65C for 24/7)
- Passive heatsinks on SoC + RAM (minimum)
- Small 5V fan recommended for 24/7 operation
- systemd watchdog for service health

---

## 10. Implementation Phases

### Phase 1: Storage Setup
1. Connect external drive (SSD or self-powered HDD)
2. Format ext4, configure fstab auto-mount
3. Create directory structure
4. Verify mount survives reboot
5. Install log2ram for SD card protection

### Phase 2: Continuous Recording
1. Configure MediaMTX native recording (try first)
2. Verify segments are created correctly
3. If issues: fall back to ffmpeg systemd service
4. Verify recording survives MediaMTX restart
5. Test playback of segments from Mac

### Phase 3: Motion Detection
1. Install motion package
2. Configure for RTSP consumption (no file output)
3. Create SQLite database and logger script
4. Test motion detection sensitivity
5. Tune threshold to minimize false positives
6. Verify event logging to SQLite

### Phase 4: Web UI
1. Build lightweight Go server (or Flask)
2. Create timeline UI with motion markers
3. Implement video segment serving with range requests
4. Test from Mac via Tailscale
5. Deploy as systemd service

### Phase 5: Cleanup & Hardening
1. Create cleanup script (hybrid age + space)
2. Configure systemd timer for daily cleanup
3. Add service dependency chain
4. Test full system reboot recovery
5. Monitor for 48 hours
6. Verify 24/7 stability

---

## 11. Open Decisions (For User)

### Storage Hardware
- [ ] **Which drive?** Use existing self-powered HDD, or buy a USB SSD?
- [ ] **If buying:** Budget preference? (1TB SSD ~$65-80)

### Web UI Technology
- [ ] **Go** (15MB RAM, fast, single binary) vs **Python Flask** (40-60MB, easier to iterate)
- Recommendation: Go for production stability, Flask for faster prototyping

### Motion Detection Scope
- [ ] **Full 720p analysis** (~50-80% of one core) - most accurate
- [ ] **Lower-res sub-stream** if configurable (~15-25% CPU) - requires MediaMTX sub-stream config
- [ ] **Defer motion detection** to Phase 3, start with continuous recording only

### Notification System (Future)
- [ ] Push notifications when motion detected? (Tailscale + webhook, or Pushover/ntfy)
- [ ] Can defer to v2

---

## 12. Research Files

All raw research data saved for reference:
- `research/storage-research.md` - Filesystem, retention, NAS, SD card wear (Gemini)
- `research/recording-research.md` - Combined recording research (Perplexity + Gemini)
- `research/recording-research-gemini.md` - Recording architecture deep analysis (Gemini)
- `research/power-storage-research.md` - Pi 3 B+ USB power and storage (Gemini)
- `research/nvr-software-research.md` - NVR software comparison (Perplexity + Gemini)

---

## Resume Command

To continue in a fresh context window:
```
Read /Users/josiahlachance/Documents/Projects/Claude/terminal/focusboard/RECORDING-ARCHITECTURE.md and enter plan mode to create a detailed implementation plan for adding local recording to the FocusBoard Pi. The user wants to start with Phase 1 (storage setup) and Phase 2 (continuous recording). SSH alias is 'focusboard', user is 'jopi'. Ask the user which storage drive they want to use before starting.
```
