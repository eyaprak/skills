# Mode: SHORTS (vertical 9:16, captioned)

A captioned vertical short from a talking-head clip: the speaker opens full-frame, shrinks to a corner PiP when the
pitch ends, and returns to full-frame for the close; pill captions track the voice. Read [engine.md](engine.md) first;
this file covers the shorts-specific differences.

## Profile
- **1080×1920**, `data-width="1080" data-height="1920"`.
- **Captioned pill style**, no hyphens, key words in `<em>` (brand-light; `.bad` red for genuinely negative words).
- **Framing = full-screen → PiP → full-screen** (engine.md §5). During the closing full-screen speech, drop captions.
- **No sponsored look**: the only always-on mark is the small centered `.topmark`. Channel avatar is optional (asked).

## Step 0 — Detect
In the `-shorts` folder: the RAW clip in `assets/`; a `profile.png` in `assets/` if present.

**The transcript is the user's input, not something you go find.** Use it only if the user pasted it or a
`transcript.txt` sits in **this** project's own folder. Otherwise **stop and ask for it before Step 1** — never adopt a
transcript from another project's folder and never auto-run `transcribe`. Full rule: [transcription.md](transcription.md).

From the transcript read **`HOOK_END`** (the second the speaker turns from pitching to explaining → PiP shrink; ~4–5s
for a one-line hook, up to ~7–8s for a longer intro) and **`CLOSE`** (the second the final CTA line begins). Ask plainly
for anything else essential that's missing.

## Step 1 — Ask (one AskUserQuestion, Turkish; skip what's given)
Append to the shared questions (renk + template kaynağı):
1. **Marka** (header "Marka") — "Hiçbiri (sponsor görünümü olmasın)" (default, first) / "Yuvarlak profil.png avatar + kanal adı" / "Sadece topmark". If a `profile.png` exists, promote the avatar option first.
2. **Kapanış** (header "Kapanış") — sets the closing framing too: "Tam ekrana dön + 'Link açıklamada' + aşağı ok" / "PiP'te kal + 'Takip Et' end-card" / "İkisi" / "Yok".
3. **Thumbnail** (header "Thumbnail") — "Inline #thumbcard (ilk 0.1s karesi)" / "Ayrı thumbnail.html" / "Yok".

## Step 2 — Re-encode
`node scripts/reencode.mjs <raw>.mp4` → `<raw>-src.mp4` (dense keyframes, audio copied). The composition's video and
audio both point at this file.

## Step 3 — Build from the bundled shorts starter
1. Copy `assets/templates/shorts/` in; update `meta.json`/`package.json` name.
2. **Media**: replace the `#vidscale > #vid` placeholder with the real speaker video, and add the voice audio. Markup:
   ```html
   <div id="vidscale">
     <video id="vid" class="clip" data-track-index="0" data-start="0" data-duration="DUR" src="assets/NAME-src.mp4" muted playsinline></video>
   </div>
   <!-- sibling of #vidframe, inside #overlay's parent (root): -->
   <audio id="aud" class="clip" data-track-index="2" data-start="0" data-duration="DUR" src="assets/NAME-src.mp4" data-volume="1"></audio>
   ```
   Set `#root data-duration` to the true clip length (cover the whole audio — the closing line is the payoff).
3. **PiP**: set the shrink at `HOOK_END` and the return at `CLOSE` (literal seconds). Keep the exact PiP target geometry.
4. **Palette**: `--brand` / `--brand-light` / `--brand-rgb` (+ `--bg-rgb` stays dark). engine.md §4.
5. **Captions**: rewrite the caption divs + timeline entries from the transcript (below). Topmark `PRODUCT /// TAG`.
6. **Branding / outro / thumbnail** per the answers; return to full-screen at `CLOSE` and drop captions during that speech.

## Step 4 — Captions from the transcript
Each caption: `<div class="cap" id="capN"><span class="cpill"><span class="accent-bar"></span><span class="ctext">…<em>key</em>…</span></span></div>`,
no hyphens. Tune each `{in,out}` to the spoken words. For a FEW captions, write explicit tweens with literal seconds
(as the starter does). For MANY captions, use the array loop (still literal numbers inside the array):
```js
const CAPS = [ {id:"cap1",in:0.15,out:4.6}, {id:"cap2",in:5.7,out:11.5}, /* one per line */ ];
CAPS.forEach(function(c){
  tl.set("#"+c.id, {visibility:"visible"}, c.in);
  tl.fromTo("#"+c.id, {opacity:0,y:26}, {opacity:1,y:0,duration:0.3,ease:"back.out(1.6)"}, c.in);
  tl.to("#"+c.id, {opacity:0,y:-16,duration:0.2,ease:"power2.in"}, c.out-0.2);
  tl.set("#"+c.id, {opacity:0,visibility:"hidden"}, c.out);   // hard kill — required, stops leaking into the next
});
```
Optional caption-lint (dev only): seek to each `out+0.01` and `console.warn` if the element is still visible.

## Step 5 — Preview & fix
`lint` → `inspect` → `preview`. Extract frames at the open, the PiP shrink, a mid caption, and the closing full-screen +
CTA. Check: PiP sits over the speaker's body; captions off the very bottom with a safe margin; no caption clipped or
leaking past its `out`; no off-frame cards; punchy-not-jittery motion.

## Step 6 — Render & verify
`render --quality high --fps 60 --video-bitrate 16M --output "renders/<name>.mp4"`. Then `ffprobe` the duration
(must equal the full clip length), confirm a mid frame, and confirm an audio stream is present.

## Design principles (impersonal)
- Aim for the middle on animation intensity: every beat gets a real entrance, a subtle `sine.inOut` hold, a clean exit;
  nothing floats perpetually, no vibrating/drifting zoom (if you zoom, one quick push-in then out).
- Anchor every element to a decimal transcript second; keep timing legible (named beats / a CAPS array) so a shift is
  a one-line edit.
- Overlays sit over the body with a safe bottom margin (clear of where the speaker is framed in the PiP).
- Captions: no hyphens; positive/key words use brand-light `<em>`, genuinely negative words use the red `.bad`.
- CTA reuses the caption look, a touch bigger; it appears on its line, then clears — nothing lingers after.
- Channel identity defaults to none (a sticky top-left name reads as sponsored); a round profile avatar is the opt-in.
- Cover the whole clip — never let the render end before the closing spoken line.
