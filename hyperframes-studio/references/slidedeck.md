# Mode: SLIDEDECK (horizontal 16:9, crossfading slides)

A sequence of crossfading slides built from a **topic or content the user gives** — HyperFrames HTML, not Marp. Read
[engine.md](engine.md) first; this file covers the deck-specific differences.

> ## ⛔ No render, and never ask about one
> A deck's deliverable is an **HTML presentation the user opens and presents from** — not a video. So:
> - **Never** ask "should I render / produce an MP4 / which outputs do you want". That question does not exist in
>   deck mode. Do not put render in an AskUserQuestion, and do not offer it at the end as a suggestion.
> - **Always** produce `presentation/presentation.html` (plus `index.html`). It is not optional and not a question.
> - Run `render` **only** if the user, unprompted, explicitly asks for a video/MP4 of the deck.
>
> Render belongs to [hook.md](hook.md) and [shorts.md](shorts.md) — those two modes ship an MP4. This one ships HTML.

## Content policy — research by default, lock on request
Two modes, decided by what the user said:

- **Locked mode** — the user explicitly restricted the content, e.g. "sadece bu datalar / bunların dışına çıkma /
  yalnızca bu bilgileri kullanarak oluştur / don't add anything beyond this". Then slide **only** what they gave — add
  no sections, bullets, stats, or claims of your own. You are the designer/animator, not the author.
- **Default (research) mode** — no such restriction (a topic, an outline, or "bununla ilgili bir sunum yap"). **Do the
  research and build a complete, well-structured deck**: develop a sensible arc (title → context → key points → detail →
  close) and write the copy yourself. Use web research if it's available (WebSearch / WebFetch, or a research skill);
  otherwise draw on your domain knowledge. Aim for an accurate, genuinely useful deck — not a padded one.

In **BOTH** modes, never fabricate specifics. If a needed fact/figure/name is genuinely unknown or unverifiable, or the
topic/scope/audience is ambiguous, raise a dedicated **AskUserQuestion** instead of making it up. "Research and build"
is license to organize and write the deck — not to invent details you're unsure of; an uncertain fact is still an ask,
not a guess.

## Profile
- **1920×1080**, `data-width="1920" data-height="1080"`.
- **Crossfading slides**: one `.scene clip` per content item, alternating `data-track-index="1"` / `"2"`, back-to-back
  (`data-start` = n × per-slide, `data-duration` = per-slide). Each slide enters with a soft opacity fade (the
  crossfade); only the FINAL slide gets an explicit exit.
- `data-duration` (root) = N slides × per-slide seconds.

## Step 0 — Detect & decide the mode
The target `-slidedeck` folder (create if asked). First decide the mode (see Content policy): did the user hand you full
content AND restrict it (→ locked), or a topic / rough outline to build out (→ research)?
- **Locked:** parse the provided content into a logical slide sequence (title → sections → close); count the natural slides.
- **Research:** research the topic (web if available, else domain knowledge), then draft a slide arc and the copy for
  each slide. Keep every claim accurate; note anything you're unsure of as an AskUserQuestion (Step 1).
Detect a primary hex if the viewer has a sibling project.

## Step 1 — Ask (one AskUserQuestion, Turkish; skip what's given)
Append to the shared questions (renk + template kaynağı) — **exactly two deck questions, no more**:
1. **Slaytlar** (header "Slaytlar") — "Hazırladığım [N] slayt sırası" / "Sıralamayı birlikte gözden geçirelim" / "Farklı böl".
2. **Tempo** (header "Tempo") — "~8s/slayt, crossfade" / "Daha hızlı (~6s)" / "Daha yavaş (~10s)" / "İçeriğe göre değişken".

There is **no output/render question**. Both `index.html` and `presentation/presentation.html` are always produced;
`presentation.html` is the animated, double-clickable file the user actually presents from (see Çıktı rehberi).

If parsing/research surfaces a genuine gap or an uncertain fact (in either mode), raise it as its own AskUserQuestion
before building — don't fabricate it.

## Step 2 — Build from the bundled slidedeck starter
1. Copy `assets/templates/slidedeck/` in (index.html, fonts/, hyperframes.json, meta.json, package.json, assets/, and
   `presentation/` — always, it is the deck's actual deliverable). Update `meta.json`/`package.json` name.
2. **Root**: `data-duration` = N × per-slide.
3. **One `.scene clip` per slide**, alternating `data-track-index="1"`/`"2"`, `data-start` = n × per-slide,
   `data-duration` = per-slide. Reuse the starter's slide layouts (title, points/cards, closing) and match each to the
   material.
4. **Fill each slide** — headline + bullets + numbers. In **locked** mode use the user's content exactly as given (add
   nothing); in **research** mode use the accurate copy you developed (ask on anything uncertain). Motion: staggered
   entrances (`power3.out` / `back.out(1.3)` / `expo.out`), a soft opacity fade-in per slide (crossfade). The only
   exit is the final slide's fade-out.
5. **Palette**: `--brand` / `--brand-light` (engine.md §4). Dark bg, near-white text.
6. **Register**: `window.__timelines["main"] = tl;`, deterministic effects only (engine.md §8).
7. **`presentation.html`** (always): the starter ships `presentation/presentation.html` + a local `gsap.min.js` —
   a standalone **animated** deck opened directly in a browser (← → / click nav, `P` auto-advance, `R` replay). Copy
   the WHOLE `presentation/` folder (the local GSAP is required — it is opened over `file://`, so no CDN). Keep it in
   the subfolder (NOT project root, or you trigger `multiple_root_compositions` — engine.md §11). Mirror the same slide
   copy into it — verify with a text diff, not by eye. Its `animateIn()` animates by LAYOUT CLASS (`.cards .card`,
   `.rows .row`, `.steps .step`, `.grid2 .cell`, `.codepanel`, …), so reusing the starter's classes gives you the
   animation for free; a genuinely new layout type needs one added `at(...)` line. Set `PER_SLIDE` to the deck's
   per-slide tempo.

## Step 3 — Lint, validate, inspect, preview
`npx --yes hyperframes@0.6.16 lint && npx --yes hyperframes@0.6.16 validate && npx --yes hyperframes@0.6.16 inspect`,
then `preview`. `validate` (WCAG AA contrast) matters most here (text on colored panels). `inspect` catches a longest
bullet overflowing the safe area. Extract a frame per slide; confirm each slide is accurate and on-topic, nothing
truncated, crossfades clean. In locked mode, also confirm no text beyond what the user gave crept in.

> **validate false positives:** it samples fixed timestamps and may measure a slide's text while that slide is
> off-screen/faded, reporting a degenerate ~1:1 contrast (engine.md §11). If a warning's contrast is ~1:1, extract the
> actual rendered frame at that timestamp to confirm the text isn't visible then — don't "fix" a phantom.

## Step 4 — Hand off (no render)
Report the two output paths, the slide count, and the total length as `N × per-slide` arithmetic. Stop there: do not
render, do not mention rendering, do not close with "istersen MP4 de alabilirim". If the user later asks for a video
on their own, the command is the shared preset from [engine.md](engine.md) §10.

## Çıktı rehberi — teslimde MUTLAKA açıkla
İki dosyanın iki ayrı işi var ve `index.html`'in tek başına açılmaması sürekli kafa karıştırıyor. Deck'i teslim ederken
bu tabloyu ver (bir kullanıcı `index.html`'i çift tıklayıp "sunum gelmiyor, sabit bir sayfa açılıyor" dediyse sebep bu):

| Dosya | Ne işe yarar | Nasıl açılır |
|---|---|---|
| `presentation/presentation.html` | **Sunumu yaptığın dosya** | Çift tıkla; ← → / tıklama, `P` otomatik, `R` tekrar |
| `index.html` | Animasyon kaynağı (HyperFrames kompozisyonu) | `preview` studio — **çift tıklayınca çalışmaz** |

`index.html` tek başına açıldığında timeline `paused` başladığı ve `data-start`/`data-duration` zamanlamasını yalnızca
motor yorumladığı için tüm slaytlar üst üste, hareketsiz görünür. Bu bir hata değil, tasarım gereğidir — düzeltmeye
çalışma; kullanıcıyı `presentation.html`'e (sunum için) veya `preview`'e (animasyonu ayıklamak için) yönlendir.

## Design principles (impersonal)
- The deliverable is an HTML presentation, not a video. Render is out of scope and is never raised as a question or
  an offer.
- Research and build by default; lock to the given content only when the user restricts it. Either way you organize,
  write, and design the deck.
- Never fabricate a specific fact: if you're unsure of a figure/name/claim, or the scope is ambiguous, that's an
  AskUserQuestion — not a guess. This holds in both modes.
- Consistency across slides matters more than novelty — reuse the starter's layouts and motion.
- Legibility over flourish: decks are text-dense — run `validate`, keep contrast honest, ~8s per slide, crossfade
  between slides, no jump cuts.
