---
name: seo-expert
description: "End-to-end SEO content creation pipeline: trend analysis, deep research, outline-first writing, inline quality gate with retry loop, and clean HTML output. Works in Claude Desktop, Claude Web, and Claude Code — no scripts or database required. Final output is a publish-ready HTML file. Use this skill whenever the user wants to create an SEO-optimized blog post, article, or web content from scratch, or says things like 'write a blog post about', 'create SEO content for', 'research and write', 'write an article on', or '/seo-expert'. The skill handles everything from topic validation through final HTML export. Trigger it even if the user just gives you a topic — you don't need them to say 'SEO' explicitly."
---

# SEO Expert

End-to-end SEO content creation pipeline. Takes a topic, performs deep research, writes high-quality content with outline approval, validates quality with an 18-check gate (retry loop up to 2 times), then produces clean semantic HTML as the final output.

Works in all Claude environments — no scripts, no database, no external services required.

## Usage

```
/seo-expert "topic or keyword" [--language <lang>] [--keyword "primary keyword"]
```

**Examples:**
```
/seo-expert "n8n automation for beginners"
/seo-expert "email marketing best practices" --language Turkish
/seo-expert "AI workflow tools comparison" --keyword "AI workflow automation"
/seo-expert "freelance SEO services pricing"
```

**Arguments:**
- Topic (required): The subject of the article. Can be broad or specific.
- `--language` (optional): Target language for the content. Defaults to the language of the topic/request.
- `--keyword` (optional): Override the primary keyword. If not given, the research phase determines it.

## Pipeline Overview

```
/seo-expert "topic"
    |
    v
[1. Parse Input & Set Language]
    |
    v
[2. Trend Analysis — 3-4 searches]
    |  → Confidence score, keyword, angle
    v
[3. Deep Research — 10-15 searches]
    |  → SERP, expert sources, stats, local context
    v
[4. Compile Research Brief]
    |  → Gaps, FAQ candidates, outline, keyword strategy
    v
[5. Generate Outline → User Approval]
    |
    v
[6. Write Content — section by section] <-------+
    |                                            |
    v                                        FAIL (retry)
[7. Quality Gate — 18 checks]                   |
    |  Score >= 70? PASS                         |
    |  Score < 70? ---- up to 2 retries ---------+
    v  PASS
[8. Generate Featured Image — optional]
    |  GOOGLE_GEMINI_API_KEY set? → Gemini API → output/[slug]/featured.png
    |  No API key? → skip (not a blocker)
    v
[9. Format HTML — clean semantic output]
    |
    v
[10. Save & Report]
    → output/[slug]/[slug].html  (references local featured image if generated)
    → output/[slug]/[slug].md    (markdown source)
    → output/[slug]/featured.png (if generated)
    → Full summary with SEO metrics
```

---

## Instructions

### Step 1: Parse Input & Set Language

Extract from the user's message:
- **Topic**: The core subject to write about
- **Language**: From `--language` flag, OR detected from topic phrasing, OR default to English
- **Primary keyword**: From `--keyword` flag, or TBD after research
- **Slug**: URL-friendly identifier from the topic (lowercase, hyphens, ASCII only)

Slug generation rules:
- Lowercase, hyphens between words
- ASCII only (convert special chars: ü→u, ö→o, ş→s, ç→c, ğ→g, ı→i, etc.)
- Remove stop words if too long (aim for under 55 chars)
- Examples: "n8n automation for beginners" → `n8n-automation-for-beginners`

---

### Step 2: Trend Analysis (3-4 searches)

**Goal**: Validate topic demand, find the best angle, determine primary keyword.

Run these searches in parallel:

1. `{topic} {current_year}` — general landscape, top results
2. `{topic} best guide complete tutorial` — what high-ranking content looks like
3. `{topic} statistics data report` — is there enough data to support the topic?
4. `{topic} vs alternatives OR comparison` — competitive angle discovery

**Extract:**
- Are there high-authority pages ranking? (validates topic demand)
- What format dominates: tutorial, listicle, comparison, case study?
- Estimated average word count of top results
- Best angle to differentiate (not covered or undercovered by existing content)
- Strongest keyword variation (the phrase with clearest search intent)

**Confidence score (1-10):**
- 8-10: Strong search demand, clear gaps, good differentiation opportunity
- 5-7: Moderate demand, proceed but note competitive landscape
- 1-4: Weak demand or extremely saturated — warn the user, ask if they want to proceed

**If confidence < 5**: Pause and present findings. Ask: "This topic may be difficult to rank for. Do you want to continue, pivot the angle, or try a different topic?"

After trend analysis, confirm the **primary keyword** (the specific phrase to optimize for).

---

### Step 3: Deep Research (10-15 searches)

Perform thorough research across four dimensions. Run queries within each group in parallel, but complete each group before moving to the next.

#### Group A: SERP Analysis (3-4 searches)

```
"{primary keyword}" best comprehensive guide {year}
"{primary keyword}" tutorial step by step
"{primary keyword}" tips mistakes common problems
"{primary keyword}" examples use cases
```

**Extract per result:**
- Title, URL, content angle, approximate length
- H2 headings visible in snippets
- "People Also Ask" questions (capture all)
- What the top 5 results DO cover (common patterns)
- What the top 5 results DON'T cover well (gaps = your advantage)

#### Group B: Expert & Official Sources (2-3 searches)

```
"{primary keyword}" official documentation OR best practices site:{relevant-domain}
"{primary keyword}" expert opinion industry analysis {year}
"{primary keyword}" research paper OR whitepaper OR case study
```

**Extract:**
- Official documentation links + key facts
- Expert quotes or paraphrased insights with attribution
- Technical details, limitations, configuration nuances

#### Group C: Data & Statistics (2-3 searches)

```
"{topic}" statistics {year} OR {year-1} data
"{topic}" market size growth trends
"{topic}" ROI benchmark survey results
```

**Extract only verifiable data with source URLs.** Never fabricate or estimate numbers.
- Specific percentages, dollar amounts, user counts
- Growth rates and trend direction
- ROI figures or time-savings benchmarks

#### Group D: Local/Contextual Research (2-3 searches)

Adapt queries to the target language and context:

- For Turkish content: Search in Turkish, look for KVKK implications, Turkish market data, TRY pricing
- For other languages: Search in target language, look for regional regulations, local pricing, local examples
- For English global: Look for US/UK/global market data, industry standards, certification bodies

```
"{topic in target language}" {country/region} {year}
"{topic}" {region} market adoption companies examples
"{topic}" {region} regulations compliance {local-regulatory-body}
```

**Extract:**
- Regional market data
- Local company examples or case studies
- Regulatory/compliance considerations specific to the region

---

### Step 4: Compile Research Brief (inline)

Synthesize all research into a structured brief. This is done in your reasoning — you do NOT need to write a separate file for this. But if you are in Claude Code or a filesystem-accessible environment, optionally save to `output/[slug]/research-brief.md`.

Structure the brief around:

1. **SERP Landscape**: Top 5 competitors, common H2 patterns, content gaps
2. **Key Statistics**: 3-5 data points with source URLs
3. **Expert Insights**: 2-3 quotes/insights with attribution
4. **Local/Contextual Data**: Regional stats, examples, compliance notes
5. **Recommended Outline**: H2 structure based on research
6. **FAQ Candidates**: 5 questions from "People Also Ask" + research
7. **Internal Linking**: Any existing pages on the user's site to link to (ask if unknown)
8. **Keyword Strategy**: Primary, secondary, long-tail keywords

**Minimum research quality bar (must meet all before proceeding):**
- [ ] 10+ WebSearch queries executed
- [ ] 5+ competitors identified with URLs and angles
- [ ] 3+ content gaps identified
- [ ] 3+ statistics with source URLs
- [ ] 5+ FAQ candidates from "People Also Ask" / forums
- [ ] Keyword strategy confirmed: primary + 3 secondary keywords

---

### Step 5: Generate Outline → User Approval

**CRITICAL: Present the outline and wait for user approval before writing any content.**

Format:

```
Here's the proposed outline for "[Title]":

**Primary Keyword:** [keyword]
**Estimated Word Count:** [range based on competitor avg]
**Content Format:** [tutorial / listicle / comparison / guide]
**Differentiation Angle:** [what makes this stand out]

---

[Introduction — hook + preview of what reader will learn]

## Table of Contents
- [All H2 sections linked]

## [H2: Opening — addresses main reader problem]
   → Key points: ...
   → Stat to include: ...

## [H2: Core Section 1]
   → ...

## [H2: Core Section 2 — addresses gap: X]
   → ...

## [H2: Practical Steps / How-To] (if applicable)
   → Step-by-step process

## [H2: Additional sections]
   → ...

## Conclusion
   → Summary + CTA

## FAQ
   → 5 questions from research

---
Shall I proceed with this outline, or would you like changes?
```

**If user requests changes**: Update and re-present before writing. If user says "go ahead" or similar, proceed.

---

### Step 6: Write Content

Write the full blog post following the approved outline. Write section by section.

**Universal Writing Rules:**

1. **Paragraphs**: 2-4 sentences maximum
2. **Sentences**: Under 25 words preferred; never exceed 35 words
3. **Data in every H2**: At least 1 statistic (with source attribution) per major section
4. **Lists**: Use bullet and numbered lists liberally for scannability
5. **Bold**: Bold key terms on first use
6. **Headings**: H2 for main sections, H3 for subsections; include keywords naturally

**Introduction Requirements:**
- First line of the markdown body (after frontmatter): `# [Generated Title]` as H1
- Hook: start with a surprising stat, bold claim, or relatable problem
- Include primary keyword within first 100 words
- Brief preview of what the reader will learn (2-3 bullets or overview)

**Table of Contents (required for 1500+ words):**
- List every H2 as an anchor link immediately after intro
- Use clean anchor slugs (lowercase, hyphens, ASCII)

**Conclusion Rules:**
- Summarize 3-4 key takeaways
- Include ONE call-to-action (to the user's site/product if known, otherwise a generic relevant resource)
- End with a declarative statement — NEVER end with a question

**FAQ Section (required):**
- 3-5 questions from the research FAQ candidates
- Each answer: 1-3 concise sentences
- Format:
  ```markdown
  ### [Question]?

  [Answer, 1-3 sentences]
  ```

**Frontmatter (YAML, top of markdown):**
```yaml
---
title: "[SEO title, max 60 chars, includes primary keyword]"
description: "[Meta description, 120-160 chars, includes keyword, ends with value prop]"
keywords: ["primary", "secondary1", "secondary2", "secondary3", "long-tail"]
language: "[content language]"
faq:
  - q: "[FAQ question 1]"
    a: "[Concise answer, 1-2 sentences]"
  - q: "[FAQ question 2]"
    a: "[Concise answer, 1-2 sentences]"
  - q: "[FAQ question 3]"
    a: "[Concise answer, 1-2 sentences]"
---
```

**Language-Specific Writing Guidelines:**

For **Turkish** content:
- Use formal address ("siz", never "sen")
- Active voice (etken cümle): "n8n bu işlemi yapar" not "Bu işlem n8n tarafından yapılır"
- Keep technical terms in English: workflow, API, node, webhook, trigger, token, LLM, RAG
- Use proper Turkish characters always: ş, ç, ü, ğ, ö, ı, İ — never ASCII approximations
- Include at least 1 Turkey-specific example per article
- Numbered steps: "1. Adım:", "2. Adım:"
- Natural Turkish phrasing — never literal translation from English

For **English** content:
- Active voice throughout
- Second person ("you can", "your workflow")
- Conversational but authoritative tone
- Numbered steps for any process

For **other languages**: Apply equivalent formality and natural phrasing standards appropriate to the language.

---

### Step 7: Quality Gate

**Preferred method — run the bundled script (Claude Code & Claude Desktop with bash):**

> Requires Node.js v18+ only — no npm install, no packages needed.

```bash
node ~/.claude/skills/seo-expert/scripts/quality-gate.mjs output/[slug]/[slug].md
```

Parse JSON from stdout. The report structure:
```json
{
  "overall_score": 87,
  "pass": true,
  "checks": {
    "readability": { "score": 85, "pass": true, "checks": [...] },
    "seo":         { "score": 90, "pass": true, "checks": [...] },
    "content":     { "score": 88, "pass": true, "checks": [...] },
    "uniqueness":  { "score": 100, "pass": true, "checks": [...] }
  },
  "warnings": [...],
  "suggestions": [...]
}
```

**Fallback — inline evaluation (Claude Web or when bash unavailable):**

If you cannot run the script, evaluate the content against all 18 checks manually. Score each 0-100, then compute weighted category scores.

**Scoring weights:** Readability 20%, SEO 30%, Content 40%, Uniqueness 10%

#### Readability Checks:
| Check | Pass Threshold |
|-------|---------------|
| Sentence length avg | < 25 words |
| Paragraph length avg | < 5 sentences |
| Passive voice ratio | < 15% of sentences |

#### SEO Checks:
| Check | Pass Threshold |
|-------|---------------|
| Title length | 30-60 chars |
| Meta description length | 120-160 chars |
| Keyword in title | Present |
| Keyword in first 100 words | Present |
| Keyword density | 1-3% of total words |
| H2 count | >= 3 |
| Internal/relative links | >= 1 |

#### Content Checks:
| Check | Pass Threshold |
|-------|---------------|
| Word count | >= 1200 words |
| FAQ section present | Required |
| CTA / external link | >= 1 |
| Does not end with question | Required |
| Table of contents (if >= 1500 words) | Present |
| Heading frequency | 1 H2/H3 per 200-300 words |

#### Uniqueness:
| Check | Pass Threshold |
|-------|---------------|
| Covers at least 1 content gap from research | Present |

**Overall score**: (Readability × 0.20) + (SEO × 0.30) + (Content × 0.40) + (Uniqueness × 0.10)

---

**Present results (both methods):**
```
Quality Gate: [PASS/FAIL] (Score: XX/100)

  Readability: XX/100
  SEO:         XX/100
  Content:     XX/100
  Uniqueness:  XX/100

Failed Checks:
  - [check name]: [what's missing / how to fix]

Suggestions:
  - [actionable improvement]
```

**If FAIL (score < 70):**
1. List specific failed checks and what needs to be fixed
2. Revise the content to address each failed check
3. Re-run/re-evaluate (max 2 retries total, 3 attempts)
4. If still failing after 3 attempts: warn the user, present the best version, and continue to HTML

**If PASS (score >= 70):** Continue to Step 8.

---

### Step 8: Generate Featured Image (Optional)

**Run the bundled script (Claude Code, Claude Desktop, Cowork):**

> Requires Node.js v18+ and a `GOOGLE_GEMINI_API_KEY`. The script auto-reads the key from: `process.env` → `./.env` → `~/.claude/.env` → `~/.env`. Free key at [aistudio.google.com](https://aistudio.google.com).

```bash
node ~/.claude/skills/seo-expert/scripts/generate-image.mjs \
  "[article title]. Topic: [primary keyword], [top 2 secondary keywords]." \
  "output/[slug]/featured.png"
```

Parse JSON from stdout:
```json
{ "success": true, "imagePath": "output/[slug]/featured.png", "sizeKb": 180 }
```

**If `success: true`:** Add an `<img>` tag referencing the local image at the top of the HTML output. Also include the path in the final report so the user can upload it to their CMS manually.

**If `success: false` with `error: "GOOGLE_GEMINI_API_KEY not set"`:**

Ask the user:
> "Image generation requires a Google Gemini API key (free at https://aistudio.google.com). Would you like to paste your key now so I can generate the featured image? You can also skip this step — the HTML output is complete without it."

- **If user provides a key**: Re-run the script with the key injected:
  ```bash
  GOOGLE_GEMINI_API_KEY="[user-provided-key]" node "$(find ~/.claude -name 'generate-image.mjs' -path '*/seo-expert/*' 2>/dev/null | head -1)" \
    "[article title]. Topic: [primary keyword], [top 2 secondary keywords]." \
    "output/[slug]/featured.png"
  ```
- **If user skips**: Note in the final report and continue to Step 9.

**If `success: false` with any other error (Gemini API error, network issue):** Log the error and continue — image is not required for the pipeline to pass.

**Claude Web fallback:** Script cannot run. Skip image generation entirely or note in the report that the user can generate one separately using `/generate-image` if they have that skill installed.

---

### Step 9: Format HTML

**Preferred method — run the bundled script (Claude Code & Claude Desktop with bash):**

> Requires Node.js v18+ only — no npm install, no packages needed.

```bash
node ~/.claude/skills/seo-expert/scripts/format-html.mjs output/[slug]/[slug].md output/[slug]/[slug].html
```

This produces clean HTML with FAQ + Article JSON-LD schema prepended automatically.

**Fallback — inline conversion (Claude Web or when bash unavailable):**

Convert the markdown content to clean, semantic HTML manually.

**Conversion Rules:**

| Markdown | HTML Output |
|----------|-------------|
| `# Heading` | `<h1>` (only if no template renders title) |
| `## Heading` | `<h2>` |
| `### Heading` | `<h3>` |
| `**bold**` | `<strong>` |
| `*italic*` | `<em>` |
| `[text](url)` | `<a href="url">text</a>` |
| `- list item` | `<ul><li>` |
| `1. list item` | `<ol><li>` |
| `` `code` `` | `<code>` |
| ` ```code block``` ` | `<pre><code>` |
| `> blockquote` | `<blockquote>` |
| `\| table \|` | `<table><tr><td>` |
| Blank line between paragraphs | `<p>` |

**Strip from HTML output** (keep only in markdown source):
- YAML frontmatter block (`---` ... `---`)
- "## Sources" or "## References" section (if any)
- "## Keyword Strategy" section (if any)

**Add to HTML output:**

1. **FAQ Schema** (JSON-LD, from frontmatter faq array):
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Question text here",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Answer text here"
      }
    }
  ]
}
</script>
```

2. **Article Schema** (optional, if article metadata available):
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "[title]",
  "description": "[meta description]",
  "keywords": "[comma-separated keywords]"
}
</script>
```

**Final HTML structure:**
```html
<!-- SEO Schema -->
<script type="application/ld+json">...</script>

<!-- Article Content -->
<h1>[Generated Title]</h1>

<p>[intro paragraph]</p>

<nav>
  <h2>Table of Contents</h2>
  <ul>
    <li><a href="#section-slug">Section Title</a></li>
    ...
  </ul>
</nav>

<h2 id="section-slug">Section Title</h2>
<p>...</p>

...

<h2 id="faq">Frequently Asked Questions</h2>
<h3>Question?</h3>
<p>Answer.</p>
```

---

### Step 10: Save & Report

#### Save Output

**In Claude Code or filesystem-accessible environments:**
- Save markdown to: `output/[slug]/[slug].md`
- Save HTML to: `output/[slug]/[slug].html`
- Optionally save research brief to: `output/[slug]/research-brief.md`

**In Claude Web (no filesystem):**
- Present the HTML in a code block
- Tell the user to copy and save it
- Also show the markdown source in a second code block

#### Present Summary

```
SEO Content Created: [PASS/FAIL] (Quality Score: XX/100)

**Content Details:**
- Title: [title] ([X] chars)
- Primary Keyword: [keyword]
- Language: [language]
- Word Count: [X] words (~[X] min read)
- Format: [tutorial/listicle/comparison/guide]

**SEO Metrics:**
- Keyword in title: [yes/no]
- H2 sections: [X]
- Data citations: [X] with sources
- Internal links: [X]
- FAQ questions: [X]
- CTA: [yes/no]

**Quality Gate:**
- Overall Score: [X]/100 ([PASS/FAIL])
- Readability: [X]/100
- SEO: [X]/100
- Content: [X]/100
- Uniqueness: [X]/100
- Retries needed: [0-2]

**Files:**
- Markdown: output/[slug]/[slug].md
- HTML: output/[slug]/[slug].html

**Trend Analysis:**
- Confidence Score: [X]/10
- Competitive Landscape: [brief note]
- Differentiation Angle: [angle used]

**Featured Image:**
- Status: [Generated / Skipped — no API key / Skipped — generation failed]
- Path: output/[slug]/featured.png (if generated)
- Note: Upload this file to your CMS/CDN to use as the post's featured image.
```

---

## Error Handling

| Step | Failure | Action |
|------|---------|--------|
| Trend analysis | Low confidence (<5) | Warn user, ask to proceed or pivot |
| Web search | No results | Try alternative query phrasing; note the gap |
| Web search | Unavailable (Claude Web without browsing) | Ask user to provide research context manually |
| No stats found | — | Note "No recent statistics found" — never fabricate data |
| Content < 1200 words after retry | — | Expand sections with more examples, sub-topics, deeper explanations |
| Quality gate fails 3 times | — | Warn user, present best version, continue to HTML |
| Image generation — no API key | — | Skip step, continue pipeline, note in report |
| Image generation — Gemini error | — | Skip step, continue pipeline, note in report |
| Filesystem unavailable | — | Present outputs inline in code blocks |

## Environment Behavior

| Feature | Claude Code | Claude Desktop | Cowork | Claude Web |
|---------|-------------|----------------|--------|------------|
| Web searches | WebSearch tool | WebSearch / browser MCP | WebSearch tool | Via browsing (if enabled) |
| File saving | Yes — output/[slug]/ | Yes — if filesystem MCP active | Yes — output/[slug]/ | No — present inline |
| Script execution | `node script.mjs` | `node script.mjs` (if bash MCP) | `node script.mjs` | Not available |
| Quality gate | Script (preferred) → inline fallback | Script (preferred) → inline fallback | Script (preferred) → inline fallback | Inline |
| HTML formatting | Script (preferred) → inline fallback | Script (preferred) → inline fallback | Script (preferred) → inline fallback | Inline |

**Cowork note:** In Cowork, use `--static` for the eval viewer, but for this skill everything runs normally. Subagents are available so research can be parallelized. Output files go into `output/[slug]/`. The Node.js scripts work as-is since Cowork has bash access.

The skill is fully functional in all environments. File saving is a bonus, not a requirement.
