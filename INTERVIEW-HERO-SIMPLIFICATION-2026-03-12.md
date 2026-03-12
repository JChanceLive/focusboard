# Interview: Hero Simplification - 2026-03-12

Context for future sessions. This captures the full back-and-forth that produced `ARCH-HERO-SIMPLIFICATION.md`.

---

## Background

User initiated session wanting to rethink the hero section after the Phase 2 hero redesign (2026-03-11) resulted in stacked calendar event cards that looked ugly. Multiple calendars feeding into `calendar_now[]` caused visual clutter.

**User's opening statement:**
> "I want to clean up right now on the Center Breathing Glow hero, how we added a bunch of items. Now they are stacked and it's ugly, and I want to rethink it. I want you to come up with a nice, simple, streamlined solution that is to the original idea and purpose of the project: to have a quick overview of the current block I'm in."
>
> "Because we're pulling multiple calendars, I think that's the problem. We should simplify it and just show plenty of data of the single activity I should be doing right now."

---

## Round 1 Questions & Answers

**Q1: Calendar Priority -- Which calendars feed FocusBoard? Should one "win"?**
> "I think what we want is what is represented in the bottom left currently, pull that data to the center yeah?"

Interpretation: The schedule list (bottom-left, from TODAY.md) should drive the hero center.

**Q2: What data matters at a glance?**
> "I want full name with the icon to the left of the name instead of above it, time-frame and length of block, the description and sub-tasks and time remaining"

**Q3: All-day / background events?**
> "Yes hide all day, put the all day label at the top of the calendars section highlighted in a fixed location so you can easily at a glance look down and see it"

**Q4: The breathing glow?**
> "I'm not sure what you mean by this? The icon I said I wanted moved to the left of the activity name yes?"

User didn't have a strong opinion on the glow effect itself -- just wants the icon repositioned left of the name.

**Q5: Gap handling (no active event)?**
> "This is fine"

Keep current behavior: show next upcoming event with countdown.

---

## Round 2 Questions & Answers

**Q6: Data source -- TODAY.md blocks vs Google Calendar events?**
> "TODAY.md and Personal Google Calendar in matching green text like it currently is in bottom right, like at 10:30 AM today I have 'Pay Bestbuy' showing and that should show up in the main hero along with the TODAY.md activity, got it?"

Key insight: BOTH sources feed the hero, but TODAY.md is primary and Personal calendar is secondary (compact one-liner).

**Q7: Does the schedule list (bottom-left) become redundant?**
> "Reduce the description steps multi-line showing bottom left, keep simple clean"

Keep the list but simplify: collapse multi-line details into single-line.

**Q8: All-day events styling in calendar section?**
> "Color matches that we decided for each calendar, it's already set I think. And I think it's already showing all-day there by default so we might be good."

No changes needed for all-day events in bottom-right -- already working.

**Q9: Behind schedule indicator?**
> "Keep it"

**Q10: Calendar events not in TODAY.md?**
> "I mentioned to add it in Q6 above, understood?"

Yes -- Personal calendar events not represented in TODAY.md still show in hero.

---

## Round 3 Questions & Answers

**Q11: Visual hierarchy confirmation**
```
[icon] Creation Stack
       10:00 AM - 12:30 PM  ·  2h 30m  ·  1h 15m left

       - Write Pioneers script
       - Review research notes

       ⏱ 3 blocks behind schedule

       ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
       💳 Pay Bestbuy · 10:30 AM          (in green)
```
> "Yes"

**Q12: Which calendars show in hero?**
> "Only personal yes."

Filter to Personal calendar only. All others (Dakboard etc.) excluded from hero.

**Q13: Multiple calendar events at once?**
> "We are not doing 3 in the hero, it's only 2 max (TODAY.md + Personal)"

Hard cap: 1 TODAY.md block + 1 Personal calendar event = 2 items max.

---

## Design Summary

The hero becomes a **single-focus display**:
1. **Primary (always):** TODAY.md current block with icon (left of name), time range, duration, time remaining, sub-tasks, behind-schedule indicator
2. **Secondary (conditional):** ONE Personal Google Calendar event as a compact one-liner in calendar color, below a subtle divider
3. **Everything else** stays in their existing locations (bottom-right calendar list, bottom-left schedule list)

The key architectural change: `calendar_now[]` still powers the bottom-right calendar list, but a NEW `hero_calendar_event` field filters to just the single Personal event for the hero.
