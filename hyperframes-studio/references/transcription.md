# Transcription & re-encoding (local, no keys)

Hook and shorts need a timestamped transcript to drive timing (caption `{in,out}`, `HOOK_END`, `CLOSE`, total
duration). HyperFrames transcribes **locally** with whisper.cpp — no API key, no webhook, no token. Slidedecks don't
transcribe (they work from pasted content).

## Transkripti al — the transcript is the USER's input

Resolve it in this order and **stop at the first match**:

1. **The user pasted a `[MM.SS - MM.SS]` transcript** with the request → use it as-is.
2. **A `transcript.txt` sits in THIS project's own folder** (the `-hook` / `-shorts` folder you are building in) → use
   it, after sanity-checking its span against `ffprobe`'s clip duration.
3. **Neither** → **STOP and ask the user for it.** A plain sentence, before AskUserQuestion and before you touch
   `index.html`: *"Bu klibin transkriptini `[MM.SS - MM.SS]` formatında paylaşır mısın?"*

**Never do instead of asking:**
- **Never adopt a `transcript.txt` from another folder or another project** — not even one whose name matches the clip,
  not even a sibling `-shorts` project for what looks like the same recording. A file living elsewhere is evidence that
  a *different* edit was made, not permission to reuse its timings here. Copying assets (logos, screenshots) across
  projects is fine; the transcript is not an asset, it is the user's input.
- **Never auto-run `transcribe` to fill the gap.** It is a fallback the user opts into, not a silent substitute for
  asking. (It also downloads a multi-hundred-MB model on first use.)

Transcribing is correct **only** when the user explicitly asks for it ("sen çıkar", "transkribe et", "transcript yok,
sen hallet"):

```bash
npx --yes hyperframes@0.6.16 transcribe <audio-or-video> --model <small.en|medium.en|medium|large-v3>
```
- **Turkish (or any non-English) content → use a multilingual model (`medium` / `large-v3`), NOT the `.en` variants.**
  The `.en` models translate non-English audio to English.
- Alternative that also scaffolds a project: `npx --yes hyperframes@0.6.16 init --video <file>` (produces a whisper
  transcript JSON alongside the scaffold).
- **First run downloads the model weights** (hundreds of MB; can take minutes). After that it's fully offline and cached.
- No audio, only a RAW clip? Extract audio first:
  `ffmpeg -i "<raw>.mp4" -vn -acodec libmp3lame -q:a 4 "<name>.mp3"`, then transcribe.

After transcribing, read the transcript and sanity-check its span against the clip length (`ffprobe`). If it comes back
empty or garbled, tell the user — don't hand-fabricate a transcript.

**Why this is strict:** every caption `{in,out}`, `HOOK_END`, `CLOSE`, scene boundary and `data-duration` is derived
from the transcript. Sourcing it from the wrong place silently mistimes the entire composition, and the user has no way
to see where the numbers came from. When you do split a long transcript line into two captions, say so — those
in-between cut points are your estimate, not something the transcript gave you.

## Re-encode RAW clips (dense keyframes)
Raw screen/webcam recordings have sparse keyframes → the render freezes or seeks wrong. Re-encode before use:

```bash
node scripts/reencode.mjs "<in>.mp4"            # → <in>-src.mp4
# or run ffmpeg directly:
ffmpeg -i "<in>.mp4" -c:v libx264 -crf 18 -preset medium -g 30 -keyint_min 30 -sc_threshold 0 -pix_fmt yuv420p -c:a copy "<in>-src.mp4"
```
Reference the re-encoded `-src.mp4` in the composition, never the raw file. Re-encode embedded demo clips too (hooks),
or they stutter.

## Requirements
- **ffmpeg** on PATH (re-encode, audio extraction, frame checks, `ffprobe` verification).
- **Node.js + npx** (the HyperFrames CLI is fetched on demand via `npx hyperframes@0.6.16`).
