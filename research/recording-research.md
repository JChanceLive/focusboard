# FocusBoard: Local Video Recording Research

**Date:** 2026-02-20
**Sources:** Perplexity API (sonar) + Gemini (2.5-flash)
**Context:** Raspberry Pi 3 B+ running MediaMTX v1.16.1 (rpicam, IMX219, 720p 15fps H.264), Chromium kiosk mode, ~443MB/906MB RAM used

---

## Table of Contents

1. [Recording Software Options](#1-recording-software-options)
2. [Storage Calculations](#2-storage-calculations)
3. [External USB Storage on Pi 3 B+](#3-external-usb-storage-on-pi-3-b)
4. [Auto-Cleanup Strategies](#4-auto-cleanup-strategies)
5. [Resource Impact on Pi 3 B+](#5-resource-impact-on-pi-3-b)
6. [Motion Detection Options](#6-motion-detection-options)
7. [Reliability for 24/7 Operation](#7-reliability-for-247-operation)
8. [Final Recommendation](#8-final-recommendation)

---

## 1. Recording Software Options

### Option A: MediaMTX Native Recording (RECOMMENDED)

MediaMTX v1.16.1 supports native recording via the `recordPath` configuration. This is the simplest and most efficient option since it handles both streaming and recording in a single process.

**Configuration in `mediamtx.yml`:**
```yaml
paths:
  cam:
    source: rpiCamera
    record: yes
    recordPath: /mnt/recordings/%path/%Y-%m-%d_%H-%M-%S
    recordFormat: fmp4          # fragmented MP4 (or "mpegts")
    recordSegmentDuration: 5m   # 5-minute segments
    recordDeleteAfter: 7d       # auto-delete after 7 days (if supported)
    rpiCameraWidth: 1280
    rpiCameraHeight: 720
    rpiCameraFPS: 15
    rpiCameraBitrate: 1500000
```

**Advantages:**
- Single process handles streaming + recording
- Zero-copy H.264 -- no re-encoding, no network loopback
- Lowest CPU/RAM overhead of all options
- Built-in segment support
- Estimated: ~10-20% CPU, ~30-70MB RAM (for both streaming AND recording)

**Disadvantages:**
- Single point of failure (if MediaMTX crashes, both streaming and recording stop)
- Less flexible than ffmpeg for advanced output customization
- Recording features depend on MediaMTX version capabilities

### Option B: ffmpeg from RTSP Stream (FALLBACK)

If MediaMTX native recording proves insufficient, ffmpeg can consume the RTSP stream and remux (codec copy, no transcode) to segmented MP4 files.

**Command:**
```bash
ffmpeg -i rtsp://localhost:8554/cam \
       -c copy \
       -map 0 \
       -f segment \
       -segment_time 300 \
       -segment_format mp4 \
       -reset_timestamps 1 \
       -strftime 1 \
       "/mnt/recordings/%Y-%m-%d_%H-%M-%S.mp4"
```

**Parameters explained:**
- `-c copy` -- remux only, no transcoding (critical for low CPU)
- `-f segment -segment_time 300` -- 5-minute file segments
- `-reset_timestamps 1` -- each segment starts at timestamp 0
- `-strftime 1` -- date-based filenames

**Estimated overhead:** ~5-10% CPU, ~15-35MB RAM

**Disadvantages:**
- Introduces loopback network overhead (localhost RTSP)
- Requires a second process
- Needs reconnection handling (ffmpeg exits if RTSP drops)

### Option C: rpicam-vid Direct Recording

`rpicam-vid` can record directly to file, but the camera is typically locked by MediaMTX when it uses the `rpiCamera` source. Running both simultaneously would require:
- MediaMTX consuming from a pipe/socket instead of direct camera access
- Or using `libcamera`'s multi-output capability

**Not recommended** -- adds significant complexity and potential camera conflicts.

### Option D: Lightweight Alternatives

| Software | RAM Usage | CPU on Pi 3 B+ | Verdict |
|----------|-----------|-----------------|---------|
| **motion** | ~50-100MB | 20-40% CPU | Viable for motion-triggered only |
| **motioneye** | ~100-200MB | 30-50% CPU | Heavy, dev branch has Bookworm support |
| **frigate** | >1GB | Very heavy | NOT viable on Pi 3 B+ |
| **go2rtc** | ~30-50MB | 20-30% CPU | Lightweight but fewer features |

**motion** is the only realistic alternative for Pi 3 B+, but only if you specifically need motion-triggered recording and are willing to accept the CPU hit.

### Option E: GStreamer Tee Pipeline

GStreamer can tee the camera output to both streaming and file. However, it's significantly more complex to configure, potentially more resource-intensive, and overkill for this use case. **Not recommended.**

---

## 2. Storage Calculations

### Continuous Recording

| Bitrate | Per Hour | Per Day (24h) | Per Week | Per Month (30d) |
|---------|----------|---------------|----------|-----------------|
| **1.5 Mbps** | 0.675 GB | 16.2 GB | 113.4 GB | 486 GB |
| **2.0 Mbps** | 0.9 GB | 21.6 GB | 151.2 GB | 648 GB |

### Motion-Triggered Recording (15% activity ratio)

| Bitrate | Per Hour (effective) | Per Day | Per Week | Per Month |
|---------|---------------------|---------|----------|-----------|
| **1.5 Mbps** | 0.10 GB | 2.43 GB | 17.0 GB | 72.9 GB |
| **2.0 Mbps** | 0.14 GB | 3.24 GB | 22.7 GB | 97.2 GB |

### Recommended Drive Sizes

| Retention | Continuous (1.5Mbps) | Motion-Triggered (1.5Mbps) |
|-----------|----------------------|---------------------------|
| **7 days** | 128 GB minimum (113 GB + headroom) | 32 GB |
| **14 days** | 256 GB minimum (227 GB + headroom) | 64 GB |
| **30 days** | 512 GB minimum (486 GB + headroom) | 128 GB |

**Note:** Always add 10-15% headroom above calculated needs. A 256GB SSD handles 14 days of continuous 1.5Mbps recording comfortably.

### Segmented vs Continuous Recording

**Segmented (5-minute MP4s) -- STRONGLY RECOMMENDED:**
- Power loss only corrupts the current 5-min segment (not hours of footage)
- Easier file management, copy, and deletion
- Faster seeking/playback
- 288 files/day at 5-min segments (manageable)

**Continuous (single large file):**
- Power failure can corrupt the entire file
- Extremely difficult to manage multi-GB files
- Not recommended for any surveillance application

---

## 3. External USB Storage on Pi 3 B+

### USB 2.0 Throughput

- **Theoretical max:** 480 Mbps (60 MB/s)
- **Real-world sustained writes:** 20-35 MB/s
- **Important:** USB 2.0 is shared with Ethernet on Pi 3 B+ (both go through an internal USB hub chip)
- **Video write requirement:** 1.5 Mbps = **0.19 MB/s** -- this is 100x less than USB 2.0 capacity
- **Verdict:** USB 2.0 is more than adequate. Even with Ethernet streaming overhead, no contention issues at these bitrates

### Power Considerations

| Device Type | Power Draw | Pi 3 B+ Direct Power? | Notes |
|-------------|-----------|----------------------|-------|
| **USB SSD (2.5")** | 2-3W peak, ~1.5W continuous | Usually yes (with good PSU) | Use powered hub for reliability |
| **USB HDD (2.5")** | 4-6W peak (spin-up), ~2.5W continuous | **NO** -- undervoltage likely | Powered USB hub required |
| **USB Flash Drive** | <1W | Yes | Fine for low bitrate, but wear concerns |
| **USB HDD (3.5")** | 6-12W | **Never** | Always needs external power |

**Recommendation:** USB SSD with a powered USB hub. The Pi 3 B+ USB ports can provide 500mA (2.5W) per port, but SSDs can spike during initialization.

### SSD vs HDD for Continuous Recording

| Factor | USB SSD | USB HDD |
|--------|---------|---------|
| **Power** | 2-3W | 4-6W |
| **Noise** | Silent | Audible |
| **Heat** | Low | Moderate |
| **Shock resistance** | Excellent | Poor |
| **Write endurance** | 100-600 TBW typical | Unlimited (mechanical) |
| **24/7 reliability** | Very good | Good (if powered properly) |
| **Cost/GB** | Higher | Lower |

At 16.2 GB/day (1.5Mbps continuous), a 250GB SSD rated at 150 TBW would last: 150,000 GB / 16.2 GB/day = **25+ years**. Write endurance is not a concern.

### Filesystem Choice

| Filesystem | Journaling | Linux Native | Best For |
|------------|-----------|-------------|----------|
| **ext4** (RECOMMENDED) | Yes | Yes | SSDs and HDDs -- mature, reliable, fast recovery |
| **f2fs** | Yes | Yes | Flash/SSD -- optimized for NAND, less mature |
| **exFAT** | No | Partial | Cross-platform sharing only -- NOT for recording |
| **NTFS** | Yes | Via ntfs-3g (slow) | Avoid on Linux |

**Use ext4** with `noatime` mount option to reduce unnecessary writes.

### Auto-Mount Configuration (fstab)

**1. Find the UUID:**
```bash
sudo blkid /dev/sda1
# Output: /dev/sda1: UUID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" TYPE="ext4"
```

**2. Create mount point:**
```bash
sudo mkdir -p /mnt/recordings
```

**3. Add to `/etc/fstab`:**
```
UUID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx /mnt/recordings ext4 defaults,noatime,nofail 0 2
```

- `noatime` -- disables access time updates (reduces writes by 20-30%)
- `nofail` -- system still boots if drive is disconnected (critical!)

**4. Test:**
```bash
sudo mount -a
df -h /mnt/recordings
```

### Failure Handling

- If USB drive fills up: ffmpeg will error out, systemd restarts it
- If USB drive disconnects: recordings fail, cleanup script should check mount status
- `nofail` in fstab prevents boot failure if drive is missing

---

## 4. Auto-Cleanup Strategies

### Recommended: Hybrid Approach (Age + Space)

Combines predictable retention with a space-based safety net.

**Cleanup Script (`/usr/local/bin/cleanup_recordings.sh`):**
```bash
#!/bin/bash
RECORDING_DIR="/mnt/recordings"
RETENTION_DAYS=7
MIN_FREE_PERCENT=10
LOGFILE="/var/log/cleanup_recordings.log"

echo "$(date): Starting cleanup..." | tee -a "$LOGFILE"

# Phase 1: Age-based cleanup (predictable retention)
echo "$(date): Deleting files older than $RETENTION_DAYS days..." | tee -a "$LOGFILE"
find "$RECORDING_DIR" -type f -name "*.mp4" -mtime +"$RETENTION_DAYS" -delete -print | tee -a "$LOGFILE"

# Phase 2: Space-based failsafe (prevent disk full)
CURRENT_FREE_KB=$(df -P "$RECORDING_DIR" | awk 'NR==2 {print $4}')
TOTAL_KB=$(df -P "$RECORDING_DIR" | awk 'NR==2 {print $2}')
REQUIRED_FREE_KB=$(echo "scale=0; $TOTAL_KB * $MIN_FREE_PERCENT / 100" | bc)

echo "$(date): Free: $((CURRENT_FREE_KB/1024))MB, Required: $((REQUIRED_FREE_KB/1024))MB" | tee -a "$LOGFILE"

while [ "$CURRENT_FREE_KB" -lt "$REQUIRED_FREE_KB" ]; do
    OLDEST=$(find "$RECORDING_DIR" -type f -name "*.mp4" -printf '%T@ %p\n' | sort -n | head -1 | awk '{print $2}')

    if [ -z "$OLDEST" ]; then
        echo "$(date): No more files to delete." | tee -a "$LOGFILE"
        break
    fi

    echo "$(date): Space low, deleting: $OLDEST" | tee -a "$LOGFILE"
    rm "$OLDEST"
    CURRENT_FREE_KB=$(df -P "$RECORDING_DIR" | awk 'NR==2 {print $4}')
done

echo "$(date): Cleanup complete." | tee -a "$LOGFILE"
```

```bash
sudo chmod +x /usr/local/bin/cleanup_recordings.sh
```

### Systemd Timer (preferred over cron for reliability)

**Service (`/etc/systemd/system/cleanup-recordings.service`):**
```ini
[Unit]
Description=Cleanup old video recordings

[Service]
Type=oneshot
ExecStart=/usr/local/bin/cleanup_recordings.sh
StandardOutput=journal
StandardError=journal
```

**Timer (`/etc/systemd/system/cleanup-recordings.timer`):**
```ini
[Unit]
Description=Run daily cleanup for video recordings

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

**Enable:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable cleanup-recordings.timer
sudo systemctl start cleanup-recordings.timer
```

### Active File Protection

- `find -mtime +N` naturally excludes currently-open files (modification time is recent)
- The space-based cleanup deletes the **oldest** files first, never the active one
- 5-minute segmented files mean the active file is always the newest

### Best Practices

- Reserve at least 10% free space as buffer
- Log all deletions for audit trail
- Check mount status before cleanup (avoid writing to SD card if USB unmounted)
- Run cleanup at off-peak hours (2 AM)

---

## 5. Resource Impact on Pi 3 B+

### Current System Load

| Component | CPU | RAM |
|-----------|-----|-----|
| Raspberry Pi OS | ~5% | ~150MB |
| MediaMTX (streaming only) | ~10-15% | ~30-50MB |
| Chromium kiosk | ~10-20% | ~200-250MB |
| **Total (current)** | **~25-40%** | **~443MB** |

### With Recording Added

| Recording Method | Additional CPU | Additional RAM | Total System |
|-----------------|---------------|---------------|--------------|
| **MediaMTX native** | +5-10% | +10-20MB | ~30-50% CPU, ~470MB RAM |
| **ffmpeg remux** | +5-10% | +15-35MB | ~35-50% CPU, ~490MB RAM |
| **ffmpeg + motion** | +30-60% | +65-185MB | ~70-100% CPU, ~600MB+ RAM |

### Feasibility Assessment

**MediaMTX native recording (RECOMMENDED):**
- Total CPU: ~30-50% -- leaves comfortable headroom
- Total RAM: ~470MB of 906MB -- ~436MB free
- **Verdict: FEASIBLE for 24/7 operation**

**ffmpeg remux (FALLBACK):**
- Total CPU: ~35-50% -- still manageable
- Total RAM: ~490MB of 906MB -- ~416MB free
- **Verdict: FEASIBLE for 24/7 operation**

**Any motion detection added:**
- Total CPU: ~70-100% -- dangerously high, likely throttling
- Total RAM: ~600MB+ -- tight
- **Verdict: NOT RECOMMENDED on Pi 3 B+**

### I/O Contention

- Recording to USB does NOT stress the SD card (separate buses)
- USB 2.0 shared with Ethernet, but 0.19 MB/s write is negligible vs 20-35 MB/s capacity
- No I/O contention expected at these bitrates

### Thermal Considerations

- Continuous recording adds modest CPU load (~5-10% with MediaMTX native)
- Pi 3 B+ runs hot under sustained load
- **Mitigation required:** Passive heatsinks at minimum; small 5V fan recommended for 24/7
- Monitor with `vcgencmd measure_temp` -- keep below 65C
- Throttling begins at ~80C

---

## 6. Motion Detection Options

### Summary: NOT RECOMMENDED for Pi 3 B+

Software-based motion detection on 720p 15fps video requires significant CPU on ARM Cortex-A53. With MediaMTX + Chromium already using 25-40% CPU, adding motion detection pushes the system to its limits.

### If You Must: Options Ranked by CPU Impact

| Method | CPU Cost | RAM | Feasibility on Pi 3 B+ |
|--------|----------|-----|------------------------|
| **External PIR sensor (GPIO)** | ~0% | 0MB | Excellent -- hardware trigger |
| **Time-scheduled recording** | 0% | 0MB | Excellent -- record only certain hours |
| **motion (low-res analysis)** | 10-20% | 50MB | Marginal -- analyze at 320x240 |
| **ffmpeg scene detection** | 15-30% | 20MB | Marginal -- limited accuracy |
| **motion (full 720p)** | 30-70% | 50-150MB | NOT viable |
| **motioneye (full)** | 40-70% | 100-200MB | NOT viable |

### MediaMTX Motion Detection

MediaMTX does NOT have built-in motion detection or webhook triggers. It is purely a streaming/recording server.

### Practical Recommendations

1. **Best approach:** Continuous recording with auto-cleanup (simple, reliable, no extra CPU)
2. **If storage is limited:** Time-scheduled recording (e.g., record 8AM-10PM only = 60% storage savings)
3. **If motion-triggered is essential:** Use an external PIR motion sensor on GPIO to trigger/stop recording via a simple script
4. **Future upgrade path:** Move to Pi 4/5 which can handle software motion detection alongside streaming

### PIR Sensor Approach (If Motion-Triggered Needed)

A PIR sensor connected to GPIO costs ~$2 and uses zero CPU for detection:
```bash
# Example: Use GPIO pin 17 with gpiozero
python3 -c "
from gpiozero import MotionSensor
from subprocess import Popen, call
import signal, sys

pir = MotionSensor(17)
proc = None

def start_recording():
    global proc
    if proc is None:
        proc = Popen(['ffmpeg', '-i', 'rtsp://localhost:8554/cam', '-c', 'copy', ...])

def stop_recording():
    global proc
    if proc:
        proc.send_signal(signal.SIGINT)
        proc = None

pir.when_motion = start_recording
pir.when_no_motion = stop_recording
signal.pause()
"
```

---

## 7. Reliability for 24/7 Operation

### SD Card Wear Protection

**Critical:** Never record video to the SD card. All recordings go to USB storage.

Additional mitigations:
- Mount `/var/log` as tmpfs to reduce OS writes:
  ```
  # Add to /etc/fstab
  tmpfs /var/log tmpfs nodev,nosuid,size=50M 0 0
  ```
- Use a high-endurance SD card (Samsung PRO Endurance, SanDisk High Endurance)
- Disable swap if not needed (or move swap to USB drive)

### Power Loss Recovery

- **Segmented recording** limits data loss to the current 5-minute segment
- **ext4 journaling** maintains filesystem integrity after unclean shutdown
- **systemd Restart=always** automatically restarts recording services after reboot

### Systemd Service for Recording

**If using ffmpeg approach (`/etc/systemd/system/ffmpeg-record.service`):**
```ini
[Unit]
Description=FFmpeg RTSP Recorder
After=network.target mediamtx.service

[Service]
ExecStart=/usr/local/bin/start_ffmpeg_record.sh
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

**Reconnection wrapper (`/usr/local/bin/start_ffmpeg_record.sh`):**
```bash
#!/bin/bash
RECORDING_DIR="/mnt/recordings"
mkdir -p "$RECORDING_DIR"

while true; do
    echo "$(date): Starting ffmpeg recording..."
    ffmpeg -hide_banner -loglevel error \
           -rtsp_transport tcp \
           -i rtsp://localhost:8554/cam \
           -c copy -map 0 \
           -f segment -segment_time 300 -segment_format mp4 \
           -reset_timestamps 1 -strftime 1 \
           "$RECORDING_DIR/%Y-%m-%d_%H-%M-%S.mp4" 2>&1

    echo "$(date): ffmpeg exited ($?). Restarting in 10s..."
    sleep 10
done
```

### Temperature Monitoring

```bash
# One-time check
vcgencmd measure_temp

# Continuous monitoring (add to cron)
# Log temperature every 5 minutes
*/5 * * * * echo "$(date): $(vcgencmd measure_temp)" >> /var/log/pi_temp.log
```

Target: Keep below 65C. Throttling starts at ~80C.

### Watchdog

- MediaMTX: `Restart=always` in systemd service
- ffmpeg: Wrapper script with reconnection loop + systemd `Restart=always`
- Cleanup: systemd timer with `Persistent=true` (runs after missed schedules)

---

## 8. Final Recommendation

### The Simplest, Most Reliable Approach

**Architecture:** MediaMTX native recording (Option A)

```
[IMX219 Camera] --> [MediaMTX v1.16.1] --> RTSP stream (for viewing)
                                       --> Local MP4 segments (recording)
```

**Hardware:**
- USB SSD (250GB for 14 days, or 128GB for 7 days at 1.5Mbps)
- Powered USB hub (recommended for SSD reliability)
- Passive heatsinks + small fan for 24/7 operation
- High-endurance SD card for OS

**Software Configuration:**
1. Format USB SSD as ext4, mount with `noatime,nofail` via fstab
2. Enable `record: yes` and `recordPath` in MediaMTX config
3. Set up cleanup timer (daily, 7-day retention + 10% space reserve)
4. Mount `/var/log` as tmpfs to protect SD card

**Expected Resource Usage:**
- CPU: ~30-50% total (MediaMTX + Chromium + recording)
- RAM: ~470MB of 906MB used (~436MB free)
- USB write: ~0.19 MB/s (trivial for USB 2.0)

**Storage Budget (1.5Mbps continuous):**
- 16.2 GB/day
- 113 GB/week
- 250GB SSD = ~14 days retention with headroom

**No motion detection on-device.** Use continuous recording with auto-cleanup for simplicity and reliability. If motion-triggered recording is needed later, add a PIR sensor (hardware, zero CPU) or upgrade to Pi 4/5.

---

## Sources

1. Home Assistant Community - Pi 3B+ camera setup: https://community.home-assistant.io/t/solved-raspberry-pi-zero-3b-as-cam-with-picam3-possible-yes/623811
2. MediaMTX on Raspbian Bookworm guide: https://james-batchelor.com/index.php/2023/11/10/install-mediamtx-on-raspbian-bookworm/
3. Raspberry Pi Camera Software Documentation: https://www.raspberrypi.com/documentation/computers/camera_software.html
4. MediaMTX GitHub Issues (recording): https://github.com/bluenviron/mediamtx/issues/4879
5. Declarative Systems - Pi IP Camera: https://www.declarativesystems.com/2025/08/20/raspberry-pi-ip-camera-2.html
