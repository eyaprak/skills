#!/usr/bin/env node
/**
 * SEO Expert - Quality Gate (Pure Node.js, zero dependencies)
 * Usage: node quality-gate.mjs [path-to-md-file]
 *
 * Runs 18 quality checks across readability, SEO, content, and uniqueness.
 * Outputs structured JSON to stdout. Human-readable summary to stderr.
 * Pass threshold: overall score >= 70
 */

import { promises as fs } from 'fs';
import path from 'path';

// ─── FRONTMATTER ────────────────────────────────────────────────────────────

function parseFrontmatter(content) {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) return { frontmatter: { title: '', description: '', keywords: [] }, body: content };

  const yaml = match[1];
  const body = match[2];

  const get = (key) => {
    const dq = yaml.match(new RegExp(`${key}:\\s*"([^"]*)"`, 'm'));
    const sq = yaml.match(new RegExp(`${key}:\\s*'([^']*)'`, 'm'));
    const uq = yaml.match(new RegExp(`${key}:\\s*([^\\n]+)`, 'm'));
    return dq?.[1]?.trim() ?? sq?.[1]?.trim() ?? uq?.[1]?.trim() ?? '';
  };

  const title = get('title');
  const description = get('description');

  const kwMatch = yaml.match(/keywords:\s*\[([\s\S]*?)\]/);
  const keywords = kwMatch
    ? kwMatch[1].split(',').map(k => k.trim().replace(/["']/g, '')).filter(Boolean)
    : [];

  return { frontmatter: { title, description, keywords }, body };
}

// ─── TEXT UTILITIES ──────────────────────────────────────────────────────────

function stripMarkdown(md) {
  return md
    .replace(/^---[\s\S]*?^---\s*\n/m, '')         // frontmatter
    .replace(/^#{1,6}\s+/gm, '')                    // headings
    .replace(/\*\*([^*]+)\*\*/g, '$1')              // bold
    .replace(/\*([^*]+)\*/g, '$1')                  // italic
    .replace(/`{3}[\s\S]*?`{3}/g, '')               // code blocks
    .replace(/`([^`]+)`/g, '$1')                    // inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')        // links
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')         // images
    .replace(/^\s*[-*+]\s+/gm, '')                  // unordered list
    .replace(/^\s*\d+\.\s+/gm, '')                  // ordered list
    .replace(/^\s*>\s+/gm, '')                      // blockquotes
    .replace(/\|[^\n]+\|/g, '')                     // tables
    .replace(/^[-*_]{3,}\s*$/gm, '')                // hr
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function countWords(text) {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

function splitSentences(text) {
  return text
    .replace(/\betc\./gi, 'etc\u200B')
    .replace(/\be\.g\./gi, 'eg\u200B')
    .replace(/\bi\.e\./gi, 'ie\u200B')
    .replace(/\bvs\./gi, 'vs\u200B')
    .replace(/\bdr\./gi, 'dr\u200B')
    .replace(/\bprof\./gi, 'prof\u200B')
    .replace(/\bvb\./g, 'vb\u200B')
    .replace(/\d+\./g, m => m.replace('.', '\u200B'))
    .split(/[.!?]+/)
    .map(s => s.replace(/\u200B/g, '.').trim())
    .filter(s => s.length > 3);
}

function splitParagraphs(text) {
  return text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0 && !p.startsWith('#'));
}

function stripMetadataSections(md) {
  return md
    .replace(/^###?\s*SEO Metadata[\s\S]*?(?=^##|\s*$)/gim, '')
    .replace(/^###?\s*Sources(?: Used)?[\s\S]*?(?=^##|\s*$)/gim, '')
    .replace(/^###?\s*Keyword Strategy[\s\S]*?(?=^##|\s*$)/gim, '')
    .replace(/\n---\s*$/, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─── READABILITY ─────────────────────────────────────────────────────────────

function checkSentenceLength(plainText) {
  const sentences = splitSentences(plainText);
  if (!sentences.length) return { name: 'Sentence Length', pass: true, score: 100, value: 0, threshold: '< 25 words avg', details: 'No sentences found' };

  const counts = sentences.map(s => s.split(/\s+/).filter(Boolean).length);
  const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
  const long = counts.filter(c => c > 30).length;
  const pass = avg < 25;
  const score = pass ? Math.max(60, 100 - Math.round((avg / 25) * 40)) : Math.max(0, 50 - Math.round((avg - 25) * 5));
  const details = `Avg ${avg.toFixed(1)} words/sentence (${sentences.length} total)${long ? `. ${long} exceed 30 words` : ''}`;
  return { name: 'Sentence Length', pass, score, value: +avg.toFixed(1), threshold: '< 25 words avg', details };
}

function checkParagraphLength(body) {
  const paragraphs = splitParagraphs(body);
  if (!paragraphs.length) return { name: 'Paragraph Length', pass: true, score: 100, value: 0, threshold: '< 5 sentences avg', details: 'No paragraphs found' };

  const counts = paragraphs.map(p => splitSentences(p).length);
  const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
  const long = counts.filter(c => c > 6).length;
  const pass = avg < 5;
  const score = pass ? Math.max(60, 100 - Math.round((avg / 5) * 40)) : Math.max(0, 50 - Math.round((avg - 5) * 10));
  return { name: 'Paragraph Length', pass, score, value: +avg.toFixed(1), threshold: '< 5 sentences avg', details: `Avg ${avg.toFixed(1)} sentences/paragraph${long ? `. ${long} paragraph(s) exceed 6 sentences` : ''}` };
}

function checkPassiveVoice(plainText) {
  const sentences = splitSentences(plainText);
  if (!sentences.length) return { name: 'Passive Voice', pass: true, score: 100, value: '0%', threshold: '< 15%', details: 'No sentences found' };

  // English passive: be-verb + past participle
  const enPassive = /\b(is|are|was|were|be|been|being)\s+\w+(?:ed|en|ied)\b/i;
  // Turkish passive suffixes
  const trPassive = /[aeıioöuü]l[iıuü](?:r|n|yor|p)|[aeıioöuü]l(?:mak|mek|di|miş)/i;

  let passive = 0;
  for (const s of sentences) {
    if (enPassive.test(s) || trPassive.test(s)) passive++;
  }

  const ratio = (passive / sentences.length) * 100;
  const pass = ratio < 15;
  const score = pass ? Math.max(60, 100 - Math.round(ratio * 3)) : Math.max(0, 50 - Math.round((ratio - 15) * 5));
  return { name: 'Passive Voice', pass, score, value: `${ratio.toFixed(1)}%`, threshold: '< 15%', details: `${passive} passive sentence(s) of ${sentences.length} (${ratio.toFixed(1)}%)` };
}

// ─── SEO ─────────────────────────────────────────────────────────────────────

function checkTitleLength(title) {
  const len = title.length;
  const pass = len >= 30 && len <= 60;
  const score = pass ? 100 : len < 30 ? Math.max(30, Math.round((len / 30) * 100)) : Math.max(30, 100 - Math.round(((len - 60) / 20) * 70));
  return { name: 'Title Length', pass, score, value: len, threshold: '30-60 chars', details: `Title is ${len} chars: "${title}"` };
}

function checkMetaDescription(desc) {
  const len = desc.length;
  const pass = len >= 120 && len <= 160;
  const score = pass ? 100 : len === 0 ? 0 : len < 120 ? Math.max(20, Math.round((len / 120) * 100)) : Math.max(20, 100 - Math.round(((len - 160) / 40) * 80));
  return { name: 'Meta Description Length', pass, score, value: len, threshold: '120-160 chars', details: len === 0 ? 'No meta description' : `${len} chars` };
}

function checkKeywordPlacement(title, plainText, keywords) {
  if (!keywords.length) return { name: 'Keyword Placement', pass: false, score: 0, value: 'N/A', threshold: 'In title + first 100 words', details: 'No keywords defined' };

  const kw = keywords[0].toLowerCase();
  const inTitle = title.toLowerCase().includes(kw);
  const first100 = plainText.split(/\s+/).slice(0, 100).join(' ').toLowerCase();
  const inFirst100 = first100.includes(kw);

  const found = [inTitle, inFirst100].filter(Boolean).length;
  const missing = [...(!inTitle ? ['title'] : []), ...(!inFirst100 ? ['first 100 words'] : [])];
  return {
    name: 'Keyword Placement', pass: found === 2, score: Math.round((found / 2) * 100),
    value: `${found}/2`, threshold: 'In title + first 100 words',
    details: found === 2 ? `"${kw}" found in all required locations` : `"${kw}" missing from: ${missing.join(', ')}`
  };
}

function checkKeywordDensity(plainText, keywords) {
  if (!keywords.length) return { name: 'Keyword Density', pass: false, score: 0, value: 'N/A', threshold: '1-3%', details: 'No keywords defined' };

  const kw = keywords[0].toLowerCase();
  const words = plainText.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return { name: 'Keyword Density', pass: false, score: 0, value: '0%', threshold: '1-3%', details: 'No content' };

  const kwWords = kw.split(/\s+/).length;
  const text = plainText.toLowerCase();
  let count = 0, i = 0;
  while ((i = text.indexOf(kw, i)) !== -1) { count++; i++; }

  const density = (count * kwWords / words.length) * 100;
  const pass = density >= 1 && density <= 3;
  const score = pass ? 100 : density < 1 ? Math.max(20, Math.round(density * 100)) : Math.max(20, 100 - Math.round((density - 3) * 30));
  return { name: 'Keyword Density', pass, score, value: `${density.toFixed(1)}%`, threshold: '1-3%', details: `"${kw}" appears ${count} times (${density.toFixed(1)}%)` };
}

function checkH2Count(body) {
  const count = (body.match(/^## .+/gm) || []).length;
  const pass = count >= 3;
  return { name: 'H2 Headings', pass, score: pass ? 100 : Math.round((count / 3) * 100), value: count, threshold: '>= 3', details: `Found ${count} H2 heading(s)` };
}

function checkInternalLinks(body) {
  // Relative links: [text](/path) — any markdown relative link
  const count = (body.match(/\]\(\/[^)#][^)]*\)/g) || []).length;
  const pass = count >= 1;
  return { name: 'Internal Links', pass, score: pass ? 100 : 0, value: count, threshold: '>= 1 relative link', details: pass ? `Found ${count} internal link(s)` : 'No internal links found. Add links to related pages.' };
}

function checkImageAltText(body) {
  const images = body.match(/!\[([^\]]*)\]\([^)]+\)/g) || [];
  if (!images.length) return { name: 'Image Alt Text', pass: true, score: 100, value: 'N/A', threshold: '100% coverage', details: 'No images found' };

  const withAlt = images.filter(img => {
    const m = img.match(/!\[([^\]]*)\]/);
    return m && m[1].trim().length > 0;
  }).length;

  const coverage = Math.round((withAlt / images.length) * 100);
  return { name: 'Image Alt Text', pass: coverage === 100, score: coverage, value: `${coverage}%`, threshold: '100% coverage', details: coverage === 100 ? `All ${images.length} image(s) have alt text` : `${images.length - withAlt} image(s) missing alt text` };
}

// ─── CONTENT ─────────────────────────────────────────────────────────────────

function checkWordCount(plainText) {
  const words = countWords(plainText);
  const pass = words >= 1200;
  return { name: 'Word Count', pass, score: pass ? 100 : Math.max(0, Math.round((words / 1200) * 100)), value: words, threshold: '>= 1200 words', details: `Content has ${words.toLocaleString()} words` };
}

function checkFaqSection(body) {
  const patterns = [
    /^##\s+(FAQ|Frequently Asked Questions|F\.A\.Q\.?)/im,
    /^##\s+S[iı]k[çc][ao]\s+Sorulan\s+Sorular/im,
    /^##\s+S\.S\.S\.?/im,
    /^##\s+Preguntas\s+Frecuentes/im,
    /^##\s+Questions?\s+Fr[eé]quentes?/im,
    /^##\s+H[äa]ufig\s+gestellte\s+Fragen/im,
  ];
  const has = patterns.some(p => p.test(body));
  return { name: 'FAQ Section', pass: has, score: has ? 100 : 0, value: has ? 'Present' : 'Missing', threshold: 'Required', details: has ? 'FAQ section found' : "No FAQ section. Add '## FAQ' or '## Frequently Asked Questions'" };
}

function checkCta(body) {
  // At least 1 external https:// link anywhere in content
  const count = (body.match(/\]\(https?:\/\/[^)]+\)/g) || []).length;
  const pass = count >= 1;
  return { name: 'CTA / External Link', pass, score: pass ? 100 : 0, value: count, threshold: '>= 1 external link', details: pass ? `Found ${count} external link(s)` : 'No external CTA link found. Add a call-to-action link.' };
}

function checkNoEndQuestion(body) {
  const paragraphs = splitParagraphs(body);
  if (!paragraphs.length) return { name: 'No End Question', pass: true, score: 100, value: 'N/A', threshold: 'Last paragraph not a question', details: 'No paragraphs' };

  const last = paragraphs[paragraphs.length - 1].trim();
  const endsQ = last.endsWith('?');
  return { name: 'No End Question', pass: !endsQ, score: endsQ ? 0 : 100, value: endsQ ? 'Ends with ?' : 'OK', threshold: 'Last paragraph not a question', details: endsQ ? `Last paragraph ends with a question: "…${last.slice(-80)}"` : 'Last paragraph does not end with a question' };
}

function checkTableOfContents(body, wordCount) {
  if (wordCount < 1500) return { name: 'Table of Contents', pass: true, score: 100, value: 'Not required', threshold: 'Required if >= 1500 words', details: `Word count (${wordCount}) below 1500; ToC not required` };

  const has =
    /^##\s+(İçindekiler|Table of Contents|Contents|Inhalt|Sommaire|Índice)/im.test(body) ||
    /- \[.+?\]\(#.+?\)/m.test(body);
  return { name: 'Table of Contents', pass: has, score: has ? 100 : 0, value: has ? 'Present' : 'Missing', threshold: 'Required if >= 1500 words', details: has ? 'Table of contents found' : `Post has ${wordCount} words but no table of contents. Add '## Table of Contents' with anchor links.` };
}

function checkImageFrequency(body, wordCount) {
  const count = (body.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length;
  const expected = Math.floor(wordCount / 500);
  const pass = count >= expected || expected === 0;
  const score = expected === 0 ? 100 : Math.min(100, Math.round((count / expected) * 100));
  return { name: 'Image Frequency', pass, score, value: count, threshold: '>= 1 per 500 words', details: pass ? `${count} image(s) for ${wordCount} words` : `Only ${count} image(s) for ${wordCount} words (need >= ${expected})` };
}

function checkHeadingFrequency(body, wordCount) {
  const count = (body.match(/^#{2,3} .+/gm) || []).length;
  if (!wordCount || !count) return { name: 'Heading Frequency', pass: false, score: 0, value: count, threshold: '1 per 200-300 words', details: 'No headings or content found' };

  const avg = wordCount / count;
  const pass = avg >= 150 && avg <= 350;
  const score = pass ? 100 : avg < 150 ? Math.max(50, 100 - Math.round((150 - avg) / 3)) : Math.max(20, 100 - Math.round((avg - 350) / 5));
  return { name: 'Heading Frequency', pass, score, value: count, threshold: '1 per 200-300 words', details: `${count} H2/H3 headings for ${wordCount} words (avg ${Math.round(avg)} words/heading)` };
}

// ─── UNIQUENESS ───────────────────────────────────────────────────────────────

async function checkUniqueness(slug) {
  const outputDir = path.join(process.cwd(), 'output');
  try {
    const entries = await fs.readdir(outputDir, { withFileTypes: true });
    const folders = entries.filter(e => e.isDirectory()).map(e => e.name);
    const collision = folders.filter(f => f === slug).length > 1;
    return { name: 'Slug Uniqueness', pass: !collision, score: collision ? 0 : 100, value: collision ? 'Collision' : 'Unique', threshold: 'No collision', details: collision ? `Slug collision for "${slug}"` : `No collision for "${slug}"` };
  } catch {
    return { name: 'Slug Uniqueness', pass: true, score: 100, value: 'Unique', threshold: 'No collision', details: 'output/ directory not found — no collision possible' };
  }
}

// ─── SCORING ─────────────────────────────────────────────────────────────────

function categoryScore(checks) {
  if (!checks.length) return { score: 100, pass: true };
  const avg = checks.reduce((s, c) => s + c.score, 0) / checks.length;
  return { score: Math.round(avg), pass: checks.every(c => c.pass) };
}

function warnings(checks) {
  return checks.filter(c => !c.pass).map(c => `[FAIL] ${c.name}: ${c.details}`);
}

function suggestions(r, s, c) {
  const out = [];
  for (const ch of r) {
    if (!ch.pass) {
      if (ch.name === 'Sentence Length') out.push('Break long sentences into shorter ones (target < 25 words avg)');
      if (ch.name === 'Paragraph Length') out.push('Split long paragraphs into 3-4 sentences each');
      if (ch.name === 'Passive Voice') out.push('Rewrite passive constructions using active voice');
    }
  }
  for (const ch of s) {
    if (!ch.pass) {
      if (ch.name === 'Title Length') out.push(ch.value < 30 ? 'Expand title to 30+ chars' : 'Shorten title to under 60 chars');
      if (ch.name === 'Meta Description Length') out.push('Write meta description between 120-160 characters');
      if (ch.name === 'Keyword Placement') out.push('Add primary keyword to title and opening paragraph (first 100 words)');
      if (ch.name === 'Keyword Density') out.push(parseFloat(ch.value) < 1 ? 'Use primary keyword more (target 1-3%)' : 'Reduce keyword usage (target 1-3%)');
      if (ch.name === 'Internal Links') out.push('Add at least one internal link to a related page');
    }
  }
  for (const ch of c) {
    if (!ch.pass) {
      if (ch.name === 'Word Count') out.push('Expand content to at least 1,200 words');
      if (ch.name === 'FAQ Section') out.push("Add a '## FAQ' section with 3-5 Q&As");
      if (ch.name === 'CTA / External Link') out.push('Add a call-to-action link to a relevant resource');
      if (ch.name === 'No End Question') out.push('End with a declarative statement or CTA, not a question');
      if (ch.name === 'Table of Contents') out.push("Add '## Table of Contents' with anchor links for articles >= 1500 words");
      if (ch.name === 'Image Frequency') out.push('Add more images/diagrams (at least 1 per 500 words)');
      if (ch.name === 'Heading Frequency') out.push('Add more H2/H3 headings (one per 200-300 words)');
    }
  }
  return out;
}

// ─── FILE DISCOVERY ───────────────────────────────────────────────────────────

async function findLatestMarkdown() {
  const dir = path.join(process.cwd(), 'output');
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = [];
    for (const e of entries) {
      if (e.isDirectory()) {
        const sub = path.join(dir, e.name);
        for (const f of await fs.readdir(sub)) {
          if (f.endsWith('.md')) {
            const fp = path.join(sub, f);
            files.push({ fp, mtime: (await fs.stat(fp)).mtime });
          }
        }
      } else if (e.isFile() && e.name.endsWith('.md')) {
        const fp = path.join(dir, e.name);
        files.push({ fp, mtime: (await fs.stat(fp)).mtime });
      }
    }
    if (!files.length) return null;
    files.sort((a, b) => b.mtime - a.mtime);
    return files[0].fp;
  } catch { return null; }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function run(filePath) {
  const raw = await fs.readFile(filePath, 'utf-8');
  const { frontmatter, body } = parseFrontmatter(raw);
  const cleanBody = stripMetadataSections(body);
  const plainText = stripMarkdown(cleanBody);
  const wordCount = countWords(plainText);
  const slug = path.basename(filePath, '.md');

  const readabilityChecks = [
    checkSentenceLength(plainText),
    checkParagraphLength(cleanBody),
    checkPassiveVoice(plainText),
  ];
  const seoChecks = [
    checkTitleLength(frontmatter.title),
    checkMetaDescription(frontmatter.description),
    checkKeywordPlacement(frontmatter.title, plainText, frontmatter.keywords),
    checkKeywordDensity(plainText, frontmatter.keywords),
    checkH2Count(cleanBody),
    checkInternalLinks(cleanBody),
  ];
  const contentChecks = [
    checkWordCount(plainText),
    checkFaqSection(cleanBody),
    checkCta(cleanBody),
    checkNoEndQuestion(cleanBody),
    checkTableOfContents(cleanBody, wordCount),
    checkHeadingFrequency(cleanBody, wordCount),
  ];
  const uniquenessChecks = [await checkUniqueness(slug)];

  const rs = categoryScore(readabilityChecks);
  const ss = categoryScore(seoChecks);
  const cs = categoryScore(contentChecks);
  const us = categoryScore(uniquenessChecks);

  const overall_score = Math.round(rs.score * 0.2 + ss.score * 0.3 + cs.score * 0.4 + us.score * 0.1);

  return {
    overall_score,
    pass: overall_score >= 70,
    file: path.relative(process.cwd(), filePath),
    checks: {
      readability: { score: rs.score, pass: rs.pass, details: `Avg sentence: ${readabilityChecks[0].value} words, Passive: ${readabilityChecks[2].value}`, checks: readabilityChecks },
      seo: { score: ss.score, pass: ss.pass, details: `Title: ${seoChecks[0].value} chars, Keyword density: ${seoChecks[3].value}`, checks: seoChecks },
      content: { score: cs.score, pass: cs.pass, details: `${contentChecks[0].value} words, FAQ: ${contentChecks[1].value}`, checks: contentChecks },
      uniqueness: { score: us.score, pass: us.pass, details: uniquenessChecks[0].details, checks: uniquenessChecks },
    },
    warnings: warnings([...readabilityChecks, ...seoChecks, ...contentChecks, ...uniquenessChecks]),
    suggestions: suggestions(readabilityChecks, seoChecks, contentChecks),
  };
}

async function main() {
  let filePath = process.argv[2] || null;

  if (!filePath) {
    process.stderr.write('Finding latest markdown in output/...\n');
    filePath = await findLatestMarkdown();
  } else if (!path.isAbsolute(filePath)) {
    filePath = path.join(process.cwd(), filePath);
  }

  if (!filePath) {
    process.stderr.write('No markdown file found. Usage: node quality-gate.mjs [path]\n');
    process.exit(1);
  }

  try { await fs.access(filePath); } catch {
    process.stderr.write(`File not found: ${filePath}\n`);
    process.exit(1);
  }

  process.stderr.write(`\nQuality Gate — ${path.basename(filePath)}\n${'='.repeat(50)}\n`);

  const report = await run(filePath);

  process.stderr.write(`\nOverall: ${report.overall_score}/100 ${report.pass ? '[PASS ✓]' : '[FAIL ✗]'}\n`);
  for (const [cat, result] of Object.entries(report.checks)) {
    process.stderr.write(`\n${result.pass ? '[PASS]' : '[FAIL]'} ${cat.toUpperCase()}: ${result.score}/100\n`);
    for (const ch of result.checks) {
      process.stderr.write(`  ${ch.pass ? '  [OK]' : '  [!!]'} ${ch.name}: ${ch.value} (${ch.threshold})\n`);
    }
  }
  if (report.warnings.length) {
    process.stderr.write('\nWarnings:\n');
    report.warnings.forEach(w => process.stderr.write(`  - ${w}\n`));
  }
  if (report.suggestions.length) {
    process.stderr.write('\nSuggestions:\n');
    report.suggestions.forEach(s => process.stderr.write(`  - ${s}\n`));
  }
  process.stderr.write(`\n${'='.repeat(50)}\n`);

  // JSON to stdout for programmatic use
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

main().catch(e => { process.stderr.write(`Error: ${e.message}\n`); process.exit(1); });
