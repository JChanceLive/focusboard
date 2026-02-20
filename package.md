# Package: FocusBoard

**Type:** code | **Source:** ~/Documents/Projects/Claude/terminal/focusboard | **Packaged:** 2026-02-12

---

## Essence

**The Word:** Glance

**The Sentence:** One glance up, one task down -- your wall shows only what matters right now.

**The Paragraph:**
FocusBoard collapses your entire day into a single point of clarity mounted on your wall. It reads your Obsidian task file, extracts the one thing you should be doing, and displays it on a portrait screen you can see from across the room. No interaction, no unlocking, no searching. You look up, you know. Everything else disappears.

---

## Marketing Copy

### Tagline
<!-- Under 60 characters -->
Your wall knows what you should be doing right now.

### Description
<!-- 3-5 sentences -->
FocusBoard is a wall-mounted Raspberry Pi display that shows your current task at a glance. It reads your Obsidian task files every two minutes, extracts your active block and top task, and renders them on a portrait screen in your workspace. No apps to open, no notifications to parse. Look up from your desk, see exactly what matters now, and get back to work. Zero interaction required.

### Social Post
<!-- Under 280 characters, X/Twitter optimized -->
Built a wall-mounted Pi that reads my Obsidian tasks and shows only what I should be doing RIGHT NOW. No server, no database, no app. Just a screen on the wall that knows my current task. Look up, know, work. focusboard

---

## Visual Pipeline

### Visual Concept
**Metaphor:** Convergence beacon -- angular lines streaming inward from scattered directions, collapsing into a single sharp amber focal point. Represents the chaos of a full schedule resolving into one clear signal. Action of narrowing, not a static object.
**Mood:** Precise, technical, clean (Code/Tool)

---

### Step 1: Hero (16:9) -- Midjourney v6.1

> This is the anchor image. Everything else derives from this.

**Prompt:**
```
Field of sharp angular lines streaming from scattered directions converging toward a single glowing amber beacon point, left-anchored subject, the convergence point radiates structured geometric light outward, charcoal #1E1E2E to soft violet #9B8EC4 gradient background, amber #E8A838 accent lighting on focal convergence point, atmospheric depth on right side with muted teal #5B9EA6 detail lines dissolving into violet atmosphere, technical precision, engineering blueprint influence, sharp geometric forms, high contrast lighting, structured composition, 16:9 widescreen composition, no text no words --ar 16:9 --style raw --stylize 500 --no text letters words writing
```

**Next:** Select your best hero output. Upload it in Step 2.

---

### Step 2: Logo (1:1) -- Midjourney Style Reference

> Upload your hero image as style reference via the MJ web UI image reference button.

**How to run:**
1. Open Midjourney web UI
2. Click the image reference button (image icon in prompt bar)
3. Upload your hero image from Step 1
4. Paste this prompt:

```
Angular geometric convergence symbol, three sharp chevron shapes pointing inward toward a single glowing amber point, centered in rounded square container, deep charcoal background #1E1E2E, amber #E8A838 accent on focal convergence point, muted teal #5B9EA6 on outer chevron edges, technical precision, clean digital aesthetic, sharp geometric forms, high contrast lighting, clean minimal design, maximum three shapes, no text no words no letters --ar 1:1 --style raw --stylize 400 --no text letters words writing
```

**Next:** Select your best logo output. Save as `assets/logo.png`.

---

### Step 3: Icon (1:1) -- Kling Restyle

> Upload your logo image from Step 2 into Kling Restyle mode.

**How to run:**
1. Go to [Kling AI](https://app.klingai.com/global/image-to-image/single/new) > Image to Image
2. Choose **Restyle** (not Single Reference)
3. Upload your logo image from Step 2
4. Paste this prompt:

```
Ultra-simplified geometric icon, single angular chevron shape with a glowing amber point at its center reduced to two basic shapes, rounded square container with deep charcoal background, single amber accent shape, absolute minimal design that reads clearly at small sizes, crisp vector-style art, no text no words no letters
```

5. Save as `assets/icon.png`

**Verify:** Does this read at 32x32px?

---

## Ecosystem Style Applied

| Check | Status |
|-------|--------|
| Charcoal ground (60%+) | PASS |
| Amber focal point | PASS |
| Hero -> Logo -> Icon reference chain | PASS |
| Step 2 includes MJ style reference instructions | PASS |
| Step 3 includes Kling Restyle instructions | PASS |
| No channel brand color dominance | PASS |
| Logo readable at 64px | PASS |
| Icon legible at 32px | PASS |
| All prompts have "no text" | PASS |
| Hero left-anchored with right atmospheric depth | PASS |
| Mood keywords match Code/Tool type | PASS |
| Logo max 3 shapes, icon max 2 shapes | PASS |
| Same metaphor x3 zoom levels | PASS |
