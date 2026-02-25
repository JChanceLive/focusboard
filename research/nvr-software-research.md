# NVR Software Research for Raspberry Pi 3 B+

**Date:** 2026-02-20
**Sources:** Perplexity API (sonar), Gemini 2.5 Flash
**Context:** Pi 3 B+ with ~450MB free RAM (906MB total), Debian 13 trixie (aarch64), MediaMTX already running at rtsp://localhost:8554/cam

---

## Hardware Constraints Summary

| Resource | Available | Notes |
|----------|-----------|-------|
| CPU | Quad-core 1.4GHz Cortex-A53 | No hardware video decode for arbitrary RTSP streams |
| RAM | ~450MB free | Other services already using ~456MB |
| GPU | VideoCore IV | Limited usefulness for NVR tasks |
| Storage | External required | USB drive for 30-day retention |
| Network | Local RTSP | MediaMTX on localhost, no network latency |

---

## Option Analysis

### 1. Frigate NVR -- NOT SUITABLE

| Aspect | Detail |
|--------|--------|
| **RAM** | Minimum 4GB (basic), 8GB recommended |
| **CPU** | Requires TensorFlow Lite; CPU inference = 5-15 seconds/frame on Pi 3 |
| **Coral TPU** | Effectively required; unusable without it on Pi 3 |
| **Pi 3 B+ compatible** | NO -- requires 64-bit OS (Pi 3 technically can run aarch64, but docs say "will not work on Pi 3 and older") |
| **RTSP consumption** | Yes, designed for RTSP IP cameras |
| **Web UI** | Excellent timeline with motion markers |
| **Continuous + markers** | Yes, records continuously and marks detection events |
| **Coexists with MediaMTX** | Yes (just consumes stream) |

**Verdict: ELIMINATED.** RAM requirement alone (4GB min) is 9x the available memory. Even if it could technically run, TFLite CPU inference would make detection unusable.

**Sources:** [Frigate docs](https://docs.frigate.video/frigate/planning_setup/), [Pi Frigate guide](https://pimylifeup.com/raspberry-pi-frigate-nvr/)

---

### 2. Shinobi -- BORDERLINE / RISKY

| Aspect | Detail |
|--------|--------|
| **RAM** | Node.js: 200-400MB + MySQL/MariaDB: 100-200MB = 300-600MB total |
| **CPU** | FFmpeg processes for motion analysis add significant load |
| **Pi 3 B+ compatible** | Technically yes, practically very tight |
| **RTSP consumption** | Yes, supports RTSP input streams |
| **Web UI** | Very capable -- live view, recording review, motion event timelines |
| **Continuous + markers** | Yes, flexible recording modes with motion flagging |
| **Coexists with MediaMTX** | Yes |

**Possible optimizations:**
- Use SQLite instead of MySQL (saves 100-200MB)
- Disable unused modules
- Minimal Node.js process count

**Verdict: HIGH RISK.** Even with SQLite and minimal config, Node.js + FFmpeg stack will likely push or exceed 450MB. System instability probable under load.

---

### 3. motionEye / motioneye -- PARTIAL FIT

| Aspect | Detail |
|--------|--------|
| **RAM** | `motion` daemon: 10-30MB; motionEye frontend: 100-200MB; Total: 110-230MB |
| **CPU** | `motion` daemon decodes frames in software; 50-80% of one core for 720p |
| **Pi 3 B+ compatible** | Yes (widely used on Pi hardware) |
| **RTSP consumption** | Yes, via `netcam_url` |
| **Web UI** | Decent for configuration and live view, but designed for motion-triggered clips not continuous timeline |
| **Continuous + markers** | PARTIAL -- `motion` can do continuous recording AND trigger event scripts, but motionEye's UI shows motion clips, not a timeline with markers in continuous recordings |
| **Coexists with MediaMTX** | Yes |

**Key issue:** The motionEye web UI is designed around motion-triggered clips and snapshots, not an elegant timeline of markers within continuous recordings. Getting the exact "continuous recording with motion markers" UI would require custom work on top of the `motion` daemon.

**Verdict: USABLE as a foundation.** The `motion` daemon alone is excellent (10-30MB RAM). The motionEye frontend adds overhead and doesn't perfectly match the UI requirement. Best approach: use `motion` daemon standalone + custom lightweight UI.

---

### 4. go2rtc + Custom Solution -- N/A (MediaMTX already fills this role)

| Aspect | Detail |
|--------|--------|
| **What go2rtc does** | Lightweight Go media broker -- ingests RTSP and re-publishes (WebRTC, HLS, etc.) |
| **What it doesn't do** | No recording, no motion detection, no browsing UI |
| **Relation to MediaMTX** | Functionally similar; both are Go-based RTSP servers/brokers |

**Verdict: REDUNDANT.** MediaMTX already provides the RTSP broker role. go2rtc would duplicate that functionality without adding NVR capabilities. Not useful here.

---

### 5. ZoneMinder -- NOT SUITABLE

| Aspect | Detail |
|--------|--------|
| **RAM** | MySQL/MariaDB: 100-200MB + Apache/Nginx + PHP: 100-150MB + ZoneMinder processes: 200MB+ = 400-550MB minimum |
| **CPU** | Multiple Perl/PHP processes + FFmpeg + OpenCV analysis |
| **Pi 3 B+ compatible** | NO -- recommended minimum 2GB RAM |
| **RTSP consumption** | Yes |
| **Web UI** | Comprehensive, mature |
| **Continuous + markers** | Yes |
| **Coexists with MediaMTX** | Yes |

**Verdict: ELIMINATED.** The full LAMP stack (MySQL + Apache + PHP + Perl) alone would consume all available RAM before ZoneMinder even starts processing video.

---

### 6. Viseron -- UNLIKELY

| Aspect | Detail |
|--------|--------|
| **RAM** | Python + OpenCV + TFLite = estimated 300-500MB |
| **CPU** | Similar to Frigate -- TFLite CPU inference is impractical on Pi 3 |
| **Pi 3 B+ compatible** | Technically can run, but detection without Coral TPU is not feasible |
| **RTSP consumption** | Yes |
| **Web UI** | Modern, decent |
| **Continuous + markers** | Yes |
| **Coexists with MediaMTX** | Yes |

**Verdict: ELIMINATED.** Same fundamental problem as Frigate -- relies on TensorFlow Lite for detection, which is impractical on Pi 3 without hardware acceleration. Python + OpenCV stack is too heavy for 450MB.

---

### 7. DIY: ffmpeg + motion daemon + Custom Web UI -- RECOMMENDED

| Aspect | Detail |
|--------|--------|
| **RAM** | ffmpeg (-c copy): ~30MB + motion daemon: ~20MB + SQLite: ~5MB + Web server: ~30-60MB = **~85-115MB total** |
| **CPU** | ffmpeg -c copy: <10% (no re-encoding) + motion daemon: 50-80% of one core (720p) |
| **Pi 3 B+ compatible** | YES -- designed to be minimal |
| **RTSP consumption** | Yes (ffmpeg and motion both consume RTSP) |
| **Web UI** | Custom-built, as lightweight as needed |
| **Continuous + markers** | YES -- exact match for requirements |
| **Coexists with MediaMTX** | YES -- both ffmpeg and motion are just RTSP clients |

#### Architecture

```
MediaMTX (rtsp://localhost:8554/cam)
    |
    +---> ffmpeg (-c copy) ---> 1-hour MP4 segments (/mnt/nvr/YYYY-MM-DD/HH.mp4)
    |
    +---> motion daemon ---> event callbacks ---> SQLite database
                                                      |
                                                      v
                                              Lightweight web server
                                              (Flask/FastAPI or Go)
                                                      |
                                                      v
                                              Browser: Timeline + Video player
```

#### Component Details

**A. Continuous Recording (ffmpeg)**

```bash
ffmpeg -i rtsp://localhost:8554/cam \
       -c copy \
       -map 0 \
       -f segment \
       -segment_time 3600 \
       -strftime 1 \
       /mnt/nvr/%Y-%m-%d/%H.mp4
```

- `-c copy` = NO re-encoding, minimal CPU usage
- 1-hour segments organized by date/hour
- RAM: ~30MB
- CPU: <10%

**B. Motion Detection (motion daemon)**

```ini
# /etc/motion/motion.conf
daemon on
netcam_url rtsp://localhost:8554/cam
netcam_keepalive on

# Disable ALL file output (we only want event callbacks)
stream_port 0
ffmpeg_output_movies off
output_pictures off
snapshot_interval 0
target_dir /dev/null

# Detection tuning
motion_detection on
minimum_motion_frames 3
threshold 1500
event_gap 10
locate_motion_mode off

# Event hooks -> log to SQLite
on_event_start /usr/local/bin/log_motion_event.py start %t
on_event_end /usr/local/bin/log_motion_event.py end %t
```

- RAM: ~10-30MB
- CPU: 50-80% of one core for 720p (main bottleneck)
- **Optimization:** If camera supports a sub-stream, feed motion a lower-res stream (360p/480p) for analysis

**C. Motion Event Logger (Python + SQLite)**

```python
#!/usr/bin/env python3
import sys, datetime, sqlite3, os

DB_PATH = '/var/lib/nvr/motion_events.db'
VIDEO_DIR = '/mnt/nvr'

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS motion_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            event_type TEXT NOT NULL,
            video_file TEXT NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_db()
    if len(sys.argv) == 3:
        event_type = sys.argv[1]
        ts = sys.argv[2]
        dt = datetime.datetime.strptime(ts, '%Y-%m-%dT%H:%M:%S')
        video_file = os.path.join(VIDEO_DIR, dt.strftime('%Y-%m-%d'), dt.strftime('%H') + '.mp4')
        conn = sqlite3.connect(DB_PATH)
        conn.execute(
            "INSERT INTO motion_events (timestamp, event_type, video_file) VALUES (?, ?, ?)",
            (dt.isoformat(), event_type, video_file)
        )
        conn.commit()
        conn.close()
```

**D. Web UI (Lightweight Flask/FastAPI)**

- Calendar/date picker to select day
- API endpoint: `/api/events?date=YYYY-MM-DD` queries SQLite
- Timeline rendered in JS (canvas or divs) showing 24 hours
- Motion markers overlaid on timeline (start/end pairs)
- Click marker -> loads correct hour MP4 segment + seeks to timestamp
- RAM: ~30-60MB (Flask) or ~10-30MB (Go)

**E. 30-Day Cleanup (Cron)**

```cron
# Delete video directories older than 30 days
0 3 * * * find /mnt/nvr -type d -mtime +30 -exec rm -rf {} \;
0 2 * * * find /mnt/nvr -type d -empty -delete

# Clean database entries older than 30 days
0 4 * * * sqlite3 /var/lib/nvr/motion_events.db "DELETE FROM motion_events WHERE timestamp < datetime('now', '-30 days');"
```

#### CPU Optimization: ffmpeg Scene Detection Alternative

Instead of the `motion` daemon, ffmpeg itself can detect scene changes:

```bash
ffmpeg -i rtsp://localhost:8554/cam \
       -vf "select='gt(scene,0.3)',showinfo" \
       -f null - 2>&1 | grep showinfo >> /var/log/nvr/scene_changes.log
```

**Pros:** No separate motion daemon, potentially lower RAM
**Cons:** Less configurable than `motion`, harder to tune sensitivity, still requires CPU for frame analysis

#### Storage Calculations (30 days continuous)

| Stream Bitrate | Daily | 30 Days | Recommended Drive |
|---------------|-------|---------|-------------------|
| 500 kbps (low quality) | ~5.4 GB | ~162 GB | 256 GB |
| 1 Mbps (decent 720p) | ~10.8 GB | ~324 GB | 512 GB |
| 2 Mbps (good 720p) | ~21.6 GB | ~648 GB | 1 TB |
| 4 Mbps (high 720p/1080p) | ~43.2 GB | ~1.3 TB | 2 TB |

---

## Comparison Matrix

| Option | RAM Needed | CPU Load | Continuous + Markers | Web UI | Pi 3 Viable | Verdict |
|--------|-----------|----------|---------------------|--------|-------------|---------|
| **DIY ffmpeg + motion** | ~100MB | Medium | YES | Custom (build it) | YES | RECOMMENDED |
| **motionEye** | ~150-230MB | Medium | Partial (UI mismatch) | Decent | Maybe | BACKUP OPTION |
| **Shinobi** | ~300-600MB | High | Yes | Excellent | Very risky | NOT RECOMMENDED |
| **Viseron** | ~300-500MB | Very High | Yes | Good | No | ELIMINATED |
| **Frigate** | 4GB+ | Very High | Yes | Excellent | No | ELIMINATED |
| **ZoneMinder** | ~400-550MB | Very High | Yes | Excellent | No | ELIMINATED |
| **go2rtc** | N/A | N/A | No (not an NVR) | No | N/A | REDUNDANT |

---

## Recommendation

### Primary: DIY ffmpeg + motion + Custom Web UI

**Total estimated NVR RAM: ~100-115MB** (well within 450MB budget)

This is the only approach that reliably fits within the Pi 3 B+ constraints while meeting all requirements:
- Continuous 24/7 recording (ffmpeg -c copy, minimal CPU)
- Motion event markers in continuous recordings (motion daemon + SQLite)
- Web UI for browsing with timeline (custom lightweight server)
- 30-day retention with auto-cleanup (cron)
- Coexists with MediaMTX (just consumes RTSP stream as a client)

**Main risk:** CPU load from `motion` daemon analyzing 720p. Mitigate by:
1. Using a lower-resolution sub-stream for motion analysis if available
2. Reducing motion detection framerate in config
3. Using ffmpeg scene detection as a lighter alternative

### Fallback: motionEye (motion daemon only)

If the custom web UI is too much work, use the `motion` daemon for detection + recording, and accept the motionEye UI limitations. Or use `motion` standalone and browse recordings via a simple file server.

### Future Upgrade Path

If upgrading to Pi 4/5 with more RAM:
- **Pi 4 (4GB+):** Shinobi becomes viable
- **Pi 5 (8GB) + Coral TPU:** Frigate becomes the best option

---

## Sources

- Frigate documentation: https://docs.frigate.video/frigate/planning_setup/
- Frigate installation: https://docs.frigate.video/frigate/installation/
- Pi Frigate guide: https://pimylifeup.com/raspberry-pi-frigate-nvr/
- Frigate discussion (Pi hardware): https://github.com/blakeblackshear/frigate/discussions/10508
- Pi 5 + Hailo AI: https://www.cnx-software.com/2025/01/10/raspberry-pi-5-edge-ai-computer-ships-with-8gb-ram-hailo-8-ai-module-supports-frigate-nvr/
- IPCamTalk forum: https://ipcamtalk.com/threads/nvr-software-for-raspberry-pi-3b-4gb-or-4-8-gb-any-recommendations.59371/
- Gemini 2.5 Flash analysis (2026-02-20)
