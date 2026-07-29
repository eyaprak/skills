# HyperFrames engine — shared spec (all three modes)

The three modes (hook / shorts / slidedeck) share ONE engine: the same boilerplate, fonts, track model,
brand-derivation formula, GSAP contract, and render preset. Only the aspect ratio, whether there are captions,
and the framing differ. Read this before editing any `index.html`; then read the per-mode file
([hook.md](hook.md) / [shorts.md](shorts.md) / [slidedeck.md](slidedeck.md)) for the differences.

The bundled starter templates in `assets/templates/<mode>/` already implement everything below with a neutral
indigo placeholder palette (`--brand:#6366f1`). You build by copying a starter and editing it — not from a blank page.

## Table of contents
1. Boilerplate (fixed)
2. Root element + track model (fixed)
3. `data-*` attribute reference
4. Brand-derivation formula (one primary → whole palette)
5. Speaker panel + PiP tween (shorts; adaptable for hooks)
6. Card stage + captions
7. Reusable classes & font-usage split
8. Scene lifecycle, animation grammar & determinism
9. `window.__hyperframes` helpers
10. Reference values + "what varies per project"
11. Gotchas that fail lint/validate/inspect (read this — it saves a round-trip)

---

## 1. Boilerplate (identical in every composition)

```html
<!doctype html>
<html lang="tr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />   <!-- 1080×1920 for shorts -->
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      /* 4 @font-face blocks — Manrope (latin + latin-ext) + JetBrains Mono (latin + latin-ext),
         each with the Turkish unicode-range. Copy verbatim from any bundled starter. */
      *{margin:0;padding:0;box-sizing:border-box;}
      html,body{width:1920px;height:1080px;overflow:hidden;background:var(--bg);font-family:"Manrope",system-ui,sans-serif;}
```

- **GSAP pinned** to `gsap@3.14.2` (the render inlines it; no other CDN scripts).
- **Fonts self-hosted**: 4 `fonts/*.woff2` (`manrope-latin`, `manrope-latinext`, `jbmono-latin`, `jbmono-latinext`) with
  Turkish unicode-ranges (ç ğ ı ş ö ü İ). CDN/built-in fonts drop Turkish glyphs — never use them. The starters bundle
  these plus `fonts/OFL.txt` (SIL OFL 1.1). Copy the whole `fonts/` folder along with the composition.
- `package.json` pins `hyperframes@0.6.16` (scripts: dev=preview, check=lint+validate+inspect, render).
  `hyperframes.json` uses the HeyGen registry with `compositions`/`assets` paths. Both ship in every starter.

## 2. Root element + track model (fixed)

```html
<div id="root" data-composition-id="main" data-start="0" data-duration="<DURATION>" data-width="1920" data-height="1080">
  <div id="backdrop" class="clip" data-track-index="3" ...> grid + glows </div>
  <div id="vidframe" class="clip" data-track-index="0" ...> speaker video </div>
  <audio id="aud" class="clip" data-track-index="2" data-volume="1" ...>   <!-- shorts/hook only -->
  <div id="overlay" class="clip" data-track-index="1" ...> captions/cards/topmark/CTA </div>
</div>
```

Track convention: **0 = video (muted)**, **1 = overlay** (captions, cards, topmark, CTA), **2 = audio**,
**3 = backdrop**, **4 = optional secondary/demo video**. Slidedecks have no video/audio — their slides live on
tracks 1/2 (alternating, so they crossfade).

**Two hard rules about tracks:**
- **Same track index = clips cannot overlap in time.** If two elements must be on screen at once, put them on
  different tracks OR nest them inside one clip and layer with CSS `z-index`. `data-track-index` does NOT control
  z-order — CSS `z-index` does. (The starters keep one clip per track and nest everything else.)
- **Standalone `index.html` puts the `data-composition-id` div directly in `<body>`** — no `<template>` wrapper
  (a `<template>` hides its contents from the renderer).

## 3. `data-*` attribute reference

| Attribute | On | Meaning |
|---|---|---|
| `data-composition-id` | root | composition id (`"main"`). Exactly ONE root html file may carry it (see §11). |
| `data-width` / `data-height` | root | 1920×1080 (hook/deck) or 1080×1920 (shorts) |
| `data-start` | clip | start second (a number, or a clip-id expression like `"intro + 2"`) |
| `data-duration` | clip | length in seconds; span the whole comp for always-on layers |
| `data-track-index` | clip | scheduling track (see §2) — not z-order |
| `data-media-start` | video/audio | trim offset into the source file (show only the telling seconds) |
| `data-volume` | audio | `1` for the voice track |
| `data-layout-allow-overflow` | any | tell `inspect` a spill is intentional (badges/tags that exceed their card) |
| `data-layout-ignore` | any | tell `inspect` to skip a decorative element |

## 4. Brand-derivation formula (one primary → whole palette)

The starters centralize this in a few CSS variables so recolor = editing two values. Given a chosen **PRIMARY** hex:

- `--brand` = PRIMARY; `--brand-light` = a lighter tint of it (used for `<em>`, highlights, accents).
- `--bg` = near-black tinted toward the brand hue (e.g. teal→`#0e0e14`, coral→`#0b0806`, indigo→`#0b0b12`).
- `--text` = near-white, faintly tinted (`#eef1f6` / `#f8efe9` / …); `--dim` = `rgba(text, 0.6)`.
- Borders `rgba(PRIMARY, 0.18–0.5)`; glows `rgba(PRIMARY, 0.16–0.26)`; grid `rgba(PRIMARY-light, ~0.05)`.
- Solid PRIMARY for: accent-bar, stage-rule, topmark icon, follow button, tag dot.
- Semantic red `#ef4444` / `#ff5e5e` for genuinely negative / "pain" words only (a caption `<em class="bad">`).

The starters also define `--brand-rgb` (same hex as decimal triplet) and `--bg-rgb` so pill backgrounds can use
`rgba(var(--brand-rgb), 0.18)`. When you switch PRIMARY, update `--brand`, `--brand-light`, and `--brand-rgb` together.
All example hexes here are neutral placeholders — there is no house brand color; the viewer picks their own.

## 5. Speaker panel + PiP tween (shorts; adaptable for hooks)

Full-frame at open → shrink to a corner PiP when the pitch ends → return to full-frame for the close.

```css
#vidframe{position:absolute;top:0;left:0;width:1080px;height:1920px;overflow:hidden;background:#08080e;z-index:1;}
#vidscale{position:absolute;top:0;left:0;width:1080px;height:1920px;transform-origin:0 0;}
#vid{display:block;width:100%;height:100%;object-fit:cover;}
```

```js
// shrink at HOOK_END, return at CLOSE — keep these numbers unless the framing needs it
tl.to("#vidframe", { top:130, left:324, width:432, height:768, borderRadius:24, duration:0.62, ease:"power3.inOut" }, HOOK_END);
tl.to("#vidscale", { scale:0.4, duration:0.62, ease:"power3.inOut" }, HOOK_END);
tl.to("#vidframe", { top:0, left:0, width:1080, height:1920, borderRadius:0, duration:0.62, ease:"power3.inOut" }, CLOSE);
tl.to("#vidscale", { scale:1, duration:0.62, ease:"power3.inOut" }, CLOSE);
```

`HOOK_END` = the second the speaker turns from pitching to explaining (from the transcript). `CLOSE` = the second
the final CTA/closing line begins. The PiP target (`top:130,left:324,432×768,scale:0.4`) sits the speaker upper-center
with the card stage below.

## 6. Card stage + captions

**Card stage** (below the PiP in shorts):
```css
.stage-rule{position:absolute;top:902px;left:50%;margin-left:-48px;width:96px;height:5px;background:var(--brand);transform:scaleX(0);}
.cardgroup{position:absolute;left:0;right:0;top:935px;height:496px;display:flex;flex-direction:column;align-items:center;justify-content:center;visibility:hidden;}
```
Each scene is a `.cardgroup` (`#acard`, `#bcard`, …) toggled `visibility hidden→visible→hidden` around its window.

**Captions** — pill style, no hyphens, key words in `<em>`:
```css
.cap{position:absolute;left:70px;right:70px;bottom:340px;display:flex;justify-content:center;visibility:hidden;}
.cap .cpill{display:inline-flex;align-items:center;gap:22px;padding:26px 40px 26px 30px;background:rgba(var(--bg-rgb),0.94);border:1px solid rgba(var(--brand-rgb),0.18);border-radius:6px;}
.cap .accent-bar{width:6px;align-self:stretch;min-height:44px;background:var(--brand);}
.cap .ctext{font-size:38px;font-weight:600;line-height:1.22;color:#f5f5f5;}
.cap .ctext em{font-style:normal;font-weight:800;color:var(--brand-light);}   /* .bad → red for pain words */
```
Per caption: enter (`0.3s back.out(1.6)`), exit (`0.2s power2.in` at `out-0.2`), and a **hard kill**
`tl.set("#capN",{opacity:0,visibility:"hidden"}, out)` so the line can't leak into the next. The starter writes
each caption explicitly; for many captions use a `CAPS` array + `forEach` — see [shorts.md](shorts.md) for that loop
(and the caption-lint check).

## 7. Reusable classes & font-usage split

Reusable pieces (in the starters — copy, don't reinvent): `.win` window card (+ `.cardhead` + `.tl-dots` mac lights),
`.tag` mono pill with a glowing `.dot`, the CTA badge, the topmark. Layout helpers: `data-layout-allow-overflow`,
`data-layout-ignore`, `data-media-start`.

**Font split:** Manrope = body, headlines, big titles, caption text. JetBrains Mono = topmark suffix, kickers/brows,
tags, window `.cardhead`, page numbers, terminal lines, badges, stat labels.

## 8. Scene lifecycle, animation grammar & determinism

Each beat/scene: toggle `visibility` at its start → content animates **in** (`back.out(1.3–1.4)` for titles/cards,
`expo.out` for side-slides, `back.out(1.8–2.4)` for badge/logo pops, `power2/3.out` for text) → a subtle
`sine.inOut` hold (`yoyo:true, repeat:1`) → a clean exit (`{opacity:0, y:-24, power2.in}`). In a slidedeck, exits are
just the crossfade (a soft opacity fade); only the FINAL slide gets an explicit exit.

**Determinism only** (the renderer captures frames out of order): `gsap.timeline({paused:true})`; register once with
`window.__timelines["main"] = tl;`. No `Math.random()`, `Date.now()`, `repeat:-1`, `setTimeout`, or async timeline
construction. Count-up via a `{v:0}` proxy `onUpdate`; typewriter via a `{n:0}` proxy slicing `textContent`; SVG draw
via static `getTotalLength()` + `strokeDasharray/Offset`.

## 9. `window.__hyperframes` helpers

Available at runtime: `window.__hyperframes.getVariables()` (read declared composition variables) and
`window.__hyperframes.fitTextFontSize(el, opts)` (shrink text to fit a box). Declared variables go on
`<html data-composition-variables='[…]'>` (types string|number|color|boolean|enum) and can be overridden at render
with `--variables '{…}'` / `--variables-file`. The starters don't need variables; add them only if you want
render-time recoloring.

## 10. Reference values + "what varies per project"

**Fixed / reference values** (change only if asked): caption box `left/right:70, bottom:340`; pill
`padding:26px 40px 26px 30px`; accent-bar `6px`; `ctext 38/600/1.22`, `em` weight 800; card stage `top:935 h:496`,
stage-rule `top:902 96×5`; PiP target `top:130,left:324,432×768,scale:0.4`; audio `data-volume:1`; render
1080p / 60fps / 16M / quality high — **render applies to hook + shorts only; a slidedeck is not rendered and render
is never offered for one** (slidedeck.md).

**What varies per project:** (1) PRIMARY hex (+ `--brand-light`/`--brand-rgb`); (2) topic/product name → topmark
label + mono suffix; (3) duration + scene count; (4) the talking-head `-src.mp4` (re-encoded); (5) caption lines +
`<em>` words + `{in,out}` seconds (shorts); (6) per-scene assets (screenshots in `.win` frames); (7) `HOOK_END` /
`CLOSE` seconds; (8) closing style; (9) thumbnail (shorts); (10) slide content (deck — user's text only).

## 11. Gotchas that fail lint/validate/inspect (read this — it saves a round-trip)

- **Timeline position parameters must be LITERAL numbers, not variables.** `tl.to("#x", {...}, 5.0)` lints clean;
  `tl.to("#x", {...}, T_DEMO)` makes lint's static analysis assume position 0 and report false
  `overlapping_gsap_tweens` warnings. Name beats in comments, but pass literal seconds.
- **Never put a media tag in an HTML comment.** A literal `<video …>` / `<audio …>` (even commented, even without a
  real `src`) is picked up by lint (`audio_src_not_found`) and inspect (`StaticGuard: has data-start but no src`).
  Describe the swap in prose, or keep the example markup in this Markdown reference (Markdown isn't scanned).
- **Exactly ONE root-level `.html` may be a composition.** A second root `.html` (e.g. `presentation.html`) triggers
  `multiple_root_compositions`. Keep any static companion in a subfolder (the deck starter ships
  `presentation/presentation.html`, fonts referenced as `../fonts/`).
- **`validate` (WCAG) false positives on hidden text.** It samples fixed timestamps and may measure a caption/slide
  element while it is off-screen or faded, reporting a degenerate ~1:1 contrast. If a warning's contrast is ~1:1 or
  identical across alpha changes, confirm by extracting the actual rendered frame at that timestamp before "fixing" it.
- **Re-encode RAW clips first.** Raw screen/webcam recordings have sparse keyframes → the render freezes or seeks
  wrong. Produce a dense-keyframe copy and reference THAT (see [transcription.md](transcription.md) / `scripts/reencode.mjs`).
- **Local `assets/` only.** Never reference `../assets` or a parent path — preview/render can't reach parent dirs and
  media goes blank.
