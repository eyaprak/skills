# Mode: HOOK (horizontal 16:9 intro)

A hook is the opening ~15–25 seconds of a long video: grab attention, tease the payoff, hand off into the main video.
It is a Short's sibling, rotated to 16:9 and **stripped of captions**. Read [engine.md](engine.md) first for the shared
structure; this file covers the hook-specific differences.

## Profile
- **1920×1080**, `data-width="1920" data-height="1080"`.
- **NO captions.** The narration is the recorded voice; you support it with visuals, not text-on-screen. If you catch
  yourself writing a `.cap` / `CAPS` array, stop — that's a Short.
- **NO persistent corner logo.** A sticky channel/brand/sponsor mark reads as an ad and hurts retention. Any logo is a
  timed animation moment, not an always-on watermark.
- **Signature device: a demo plays big.** A product/demo clip (or hero screenshot) fills a large panel with a
  darkening overlay while the matching narration line is spoken, ending exactly when that line ends. Trim the embedded
  clip with `data-media-start`.
- Runs ~15–25s.

## Step 0 — Detect
Look in the `-hook` project folder: the RAW talking-head clip; demo/tanıtım clips + screenshots in `assets/`; a detected
primary hex if the viewer has a sibling project.

**The transcript is the user's input, not something you go find** — it drives the beat map and the total duration. Use
it only if the user pasted it or a `transcript.txt` sits in **this** project's own folder. Otherwise **stop and ask for
it before Step 1** — never adopt a transcript from another project's folder (a sibling `-shorts` project of the same
recording is still the wrong source) and never auto-run `transcribe`. Full rule:
[transcription.md](transcription.md). If the RAW clip is missing, ask plainly too — don't invent either of them.

## Step 1 — Ask (one AskUserQuestion, Turkish; skip anything already given)
Option 1 is always the recommended/detected value. Append these to the shared questions (renk + template kaynağı):
1. **Demo** (header "Demo") — which asset fills the big panel and on which narration beat, or "Demo yok".
2. **Logolar** (header "Logolar") — which logos fly in from the sides and when, or "Logo animasyonu yok".
3. **Kapanış** (header "Kapanış") — "Ana videoya köprü" / "Açık kapanış repliğini komple kaldır" / "Starter'daki kapanışı kullan".

If everything is resolved by args + detection, skip the call and state the resolved values in a one-line Turkish preamble.

## Step 2 — Re-encode
Re-encode the RAW talking-head clip AND every demo clip you embed to a dense-keyframe `-src.mp4`
(`node scripts/reencode.mjs <in.mp4>` or the ffmpeg recipe in [transcription.md](transcription.md)). Reference the
re-encoded copies, never the raw files (demos stutter/freeze otherwise).

## Step 3 — Build from the bundled hook starter
1. Copy `assets/templates/hook/` into the project (index.html, fonts/, hyperframes.json, meta.json, package.json,
   assets/). Update `meta.json`/`package.json` name.
2. **Media**: replace the `#vidframe` placeholder with the real speaker video + audio. The exact markup:
   ```html
   <div id="vidframe" class="clip" data-track-index="0" data-start="0" data-duration="DUR">
     <video id="vid" class="clip" data-track-index="0" data-start="0" data-duration="DUR" src="assets/NAME-src.mp4" muted playsinline></video>
   </div>
   <audio id="aud" class="clip" data-track-index="2" data-start="0" data-duration="DUR" src="assets/NAME-src.mp4" data-volume="1"></audio>
   ```
   Set `#root data-duration` to the true clip length.
3. **Demo on a panel**: point the starter's `#demo` at a real clip on track 1 (or 4) with `data-start`/`data-duration`
   timed to its narration line and `data-media-start` to trim; keep the `#demoDim` darkening. It ends when the line ends.
4. **Palette**: set `--brand` / `--brand-light` / (`--brand-rgb` if present) to the chosen hex (engine.md §4). Dark bg stays.
5. **Side-entering animations & logo moments**: reuse the starter's `expo.out` side-slides and `back.out` chip pops,
   anchored to transcript beats (literal seconds — engine.md §11).
6. **No caption layer, no sticky logo.** Closing per the answer.

## Step 4 — Preview & fix
`npx --yes hyperframes@0.6.16 lint && npx --yes hyperframes@0.6.16 inspect`, then `preview`. Extract frames at the open,
the demo-plays-big moment, each side animation, and the close. Check: the demo darkening reads well and ends on its
line; animations feel punchy not floaty; nothing off-frame; no accidental caption; no sticky corner logo.

## Step 5 — Render & verify
`npx --yes hyperframes@0.6.16 render --quality high --fps 60 --video-bitrate 16M --output "renders/<name>.mp4"`.
Verify with `ffprobe` that the duration covers the full audio, a mid frame looks right, and audio is present.

## Design principles (impersonal — bake in from the first draft)
- The hook's whole job is the first impression. Front-load the most striking visual; don't slow-build into it.
- Animations enter from the sides and name the topic — they punctuate the words, not decorate the frame. Balance the
  intensity: every beat gets a real entrance, a calm hold, a clean exit — no perpetual floating, no vibrating zoom.
- The demo-plays-big moment is the centerpiece; trim it so only the telling seconds show.
- No sponsored look: a logo is a timed animation, never an always-on corner mark.
- A hook can hand off with a clean bridge/cut rather than an explicit spoken "let's begin" — offer to drop that line.
- Anchor every element to a decimal transcript second, in code, so a "shift 0.2s later" note is a one-line change.
