<!-- MEMORY:START -->
# mac

_Last updated: 2026-03-11 | 8 active memories, 9 total_

## Key Decisions
- FocusBoard stale event detection uses 5-minute grace period for recently-ended events (time < end + 300s) to handle e... [focusboard, calendar, state-generation, edge-case]
- FocusBoard hero description max-height increased from 120px to 200px on 1920px portrait display to accommodate longer... [focusboard, ui, responsive-design]

## Patterns & Conventions
- FocusBoard full-day timed event handling: events with `dateTime` fields that span midnight-to-midnight (e.g., 'BATCH ... [focusboard, calendar, event-handling, sorting, ui]
- FocusBoard NOW badge implementation: calendar events matching `calendar_now.current_event` receive a `.now-badge` ind... [focusboard, calendar, visual-indicator, event-matching]
- FocusBoard elapsed time display: current schedule block shows 'started Xm ago' using `(Date.now() - blockStartTime) /... [focusboard, schedule, time-display, ui]
- FocusBoard micro upgrades pattern: NOW badge styling uses opacity transitions for discrete/continuous display states,... [focusboard, frontend, ui-pattern, state-management]

## Current Progress
- FocusBoard Hero Redesign Phase 2 micro upgrades DEPLOYED (2026-03-11): NOW badge, elapsed time display, icon mapping,... [focusboard, hero-redesign, phase-2-ongoing, deployment, verified]
- FocusBoard Hero Redesign Phase 1 backend COMPLETE: compute_calendar_now() function filters active events by wall-cloc... [focusboard, hero-redesign, phase-1-complete, backend, calendar-integration]

_For deeper context, use memory_search, memory_related, or memory_ask tools._
<!-- MEMORY:END -->
