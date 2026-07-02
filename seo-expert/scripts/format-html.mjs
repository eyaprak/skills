#!/usr/bin/env node
/**
 * SEO Expert - Format HTML (Pure Node.js, zero dependencies)
 * Usage: node format-html.mjs [input.md] [output.html]
 *
 * Converts markdown to clean semantic HTML with FAQ + Article JSON-LD schema.
 * Strips frontmatter, SEO metadata sections, and sources sections.
 */

import { promises as fs } from 'fs';
import path from 'path';

// ─── FRONTMATTER ────────────────────────────────────────────────────────────

function parseFrontmatter(content) {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };

  const yaml = match[1];
  const body = match[2];

  const get = (key) => {
    const dq = yaml.match(new RegExp(`${key}:\\s*"([^"]*)"`, 'm'));
    const sq = yaml.match(new RegExp(`${key}:\\s*'([^']*)'`, 'm'));
    const uq = yaml.match(new RegExp(`${key}:\\s*([^\\n]+)`, 'm'));
    return dq?.[1]?.trim() ?? sq?.[1]?.trim() ?? uq?.[1]?.trim() ?? '';
  };

  const kwMatch = yaml.match(/keywords:\s*\[([\s\S]*?)\]/);
  const keywords = kwMatch
    ? kwMatch[1].split(',').map(k => k.trim().replace(/["']/g, '')).filter(Boolean)
    : [];

  // Parse FAQ items
  const faq = [];
  const faqBlock = yaml.match(/^faq:\s*\n((?:[ \t]+[-\s\S]*?\n?)*)/m);
  if (faqBlock) {
    const pairs = [...faqBlock[1].matchAll(/[-\s]+q:\s*["']?(.+?)["']?\s*\n\s+a:\s*["']?(.+?)["']?(?:\n|$)/g)];
    for (const [, q, a] of pairs) faq.push({ q: q.trim(), a: a.trim() });
  }

  return {
    frontmatter: { title: get('title'), description: get('description'), keywords, faq },
    body,
  };
}

// ─── MARKDOWN CLEANUP ─────────────────────────────────────────────────────────

function stripMetadataSections(md) {
  return md
    .replace(/^###?\s*SEO Metadata[\s\S]*?(?=^##|\s*$)/gim, '')
    .replace(/^###?\s*Sources(?: Used)?[\s\S]*?(?=^##|\s*$)/gim, '')
    .replace(/^###?\s*Keyword Strategy[\s\S]*?(?=^##|\s*$)/gim, '')
    .replace(/\n---\s*$/, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─── MARKDOWN → HTML ──────────────────────────────────────────────────────────

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(text) {
  return text.toLowerCase()
    .replace(/[şs]/g, 's').replace(/[çc]/g, 'c').replace(/[üu]/g, 'u')
    .replace(/[öo]/g, 'o').replace(/[ğg]/g, 'g').replace(/[ıi]/g, 'i')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function inlineMarkdown(text) {
  return text
    // Code inline (before bold/italic to avoid conflicts)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    // Images (before links)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy">`)
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) => `<a href="${escapeHtml(href)}">${text}</a>`)
    // Strikethrough
    .replace(/~~(.+?)~~/g, '<del>$1</del>');
}

function parseTable(lines) {
  const rows = lines.filter(l => !l.match(/^\|[-: |]+\|$/));
  if (rows.length === 0) return '';

  const parseRow = (line, tag) =>
    '<tr>' + line.split('|').slice(1, -1).map(cell => `<${tag}>${inlineMarkdown(cell.trim())}</${tag}>`).join('') + '</tr>';

  const header = parseRow(rows[0], 'th');
  const body = rows.slice(1).map(r => parseRow(r, 'td')).join('\n');
  return `<table>\n<thead>\n${header}\n</thead>\n<tbody>\n${body}\n</tbody>\n</table>`;
}

function markdownToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.match(/^```/)) {
      const lang = line.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].match(/^```/)) {
        codeLines.push(escapeHtml(lines[i]));
        i++;
      }
      out.push(`<pre><code${lang ? ` class="language-${lang}"` : ''}>${codeLines.join('\n')}</code></pre>`);
      i++;
      continue;
    }

    // Headings
    const h6 = line.match(/^######\s+(.+)/); if (h6) { out.push(`<h6>${inlineMarkdown(h6[1])}</h6>`); i++; continue; }
    const h5 = line.match(/^#####\s+(.+)/);  if (h5) { out.push(`<h5>${inlineMarkdown(h5[1])}</h5>`); i++; continue; }
    const h4 = line.match(/^####\s+(.+)/);   if (h4) { out.push(`<h4>${inlineMarkdown(h4[1])}</h4>`); i++; continue; }
    const h3 = line.match(/^###\s+(.+)/);    if (h3) { const id = slugify(h3[1]); out.push(`<h3 id="${id}">${inlineMarkdown(h3[1])}</h3>`); i++; continue; }
    const h2 = line.match(/^##\s+(.+)/);     if (h2) { const id = slugify(h2[1]); out.push(`<h2 id="${id}">${inlineMarkdown(h2[1])}</h2>`); i++; continue; }
    const h1 = line.match(/^#\s+(.+)/);      if (h1) { out.push(`<h1>${inlineMarkdown(h1[1])}</h1>`); i++; continue; }

    // Horizontal rule
    if (line.match(/^[-*_]{3,}\s*$/)) { out.push('<hr>'); i++; continue; }

    // Blockquote
    if (line.startsWith('> ')) {
      const bqLines = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        bqLines.push(lines[i].slice(2));
        i++;
      }
      out.push(`<blockquote><p>${bqLines.map(inlineMarkdown).join('<br>')}</p></blockquote>`);
      continue;
    }

    // Table
    if (line.startsWith('|') && line.endsWith('|')) {
      const tableLines = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      out.push(parseTable(tableLines));
      continue;
    }

    // Unordered list
    if (line.match(/^\s*[-*+]\s+/)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^\s*[-*+]\s+/)) {
        items.push(`<li>${inlineMarkdown(lines[i].replace(/^\s*[-*+]\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ul>\n${items.join('\n')}\n</ul>`);
      continue;
    }

    // Ordered list
    if (line.match(/^\s*\d+\.\s+/)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^\s*\d+\.\s+/)) {
        items.push(`<li>${inlineMarkdown(lines[i].replace(/^\s*\d+\.\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ol>\n${items.join('\n')}\n</ol>`);
      continue;
    }

    // Empty line — skip (paragraphs are formed below)
    if (line.trim() === '') { i++; continue; }

    // Paragraph — collect consecutive non-empty, non-structural lines
    const paraLines = [];
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].match(/^#{1,6}\s|^```|^\|.+\||^\s*[-*+]\s|^\s*\d+\.\s|^[-*_]{3,}\s*$|^> /)) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length) {
      out.push(`<p>${inlineMarkdown(paraLines.join(' '))}</p>`);
    }
  }

  return out.join('\n');
}

// ─── SCHEMA GENERATION ───────────────────────────────────────────────────────

function faqSchema(faq) {
  if (!faq?.length) return '';
  return `<script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faq.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
}, null, 2)}
</script>\n\n`;
}

function articleSchema({ title, description, keywords }) {
  if (!title) return '';
  const schema = { '@context': 'https://schema.org', '@type': 'Article', headline: title };
  if (description) schema.description = description;
  if (keywords?.length) schema.keywords = keywords.join(', ');
  return `<script type="application/ld+json">
${JSON.stringify(schema, null, 2)}
</script>\n\n`;
}

// ─── UTILITIES ────────────────────────────────────────────────────────────────

function excerpt(html, max = 160) {
  const text = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.lastIndexOf(' ', max);
  return (cut > max * 0.8 ? text.slice(0, cut) : text.slice(0, max)) + '…';
}

function wordCount(html) {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length;
}

async function findLatestMarkdown() {
  const dir = path.join(process.cwd(), 'output');
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = [];
    for (const e of entries) {
      if (e.isDirectory()) {
        for (const f of await fs.readdir(path.join(dir, e.name))) {
          if (f.endsWith('.md')) {
            const fp = path.join(dir, e.name, f);
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

async function main() {
  const args = process.argv.slice(2);
  const outputDir = path.join(process.cwd(), 'output');

  let inputPath = args[0] || null;
  if (!inputPath) {
    console.log('Finding latest markdown in output/...');
    inputPath = await findLatestMarkdown();
  } else if (!path.isAbsolute(inputPath)) {
    const inOutput = path.join(outputDir, inputPath);
    inputPath = (await fs.stat(inOutput).catch(() => null)) ? inOutput : path.join(process.cwd(), inputPath);
  }

  if (!inputPath) {
    console.error('No markdown file found. Usage: node format-html.mjs [input.md] [output.html]');
    process.exit(1);
  }

  const raw = await fs.readFile(inputPath, 'utf-8');
  const { frontmatter, body } = parseFrontmatter(raw);
  const clean = stripMetadataSections(body);

  // Ensure H1 title appears at top of content.
  // If the body already starts with a # heading, the markdown conversion handles it.
  // If not (e.g. template was supposed to render the title), inject it from frontmatter.
  const bodyHasH1 = /^\s*#\s+\S/.test(clean);
  const titleHtml = (!bodyHasH1 && frontmatter.title)
    ? `<h1>${escapeHtml(frontmatter.title)}</h1>\n\n`
    : '';

  const html = markdownToHtml(clean);
  const fullHtml = faqSchema(frontmatter.faq) + articleSchema(frontmatter) + titleHtml + html;

  const outputPath = args[1]
    ? (path.isAbsolute(args[1]) ? args[1] : path.join(process.cwd(), args[1]))
    : inputPath.replace(/\.md$/, '.html');

  await fs.writeFile(outputPath, fullHtml, 'utf-8');

  const wc = wordCount(html);
  const ex = excerpt(html);
  console.log(`\nHTML Output: ${outputPath}`);
  console.log(`Word count:  ${wc}`);
  console.log(`Excerpt:     ${ex.slice(0, 80)}…`);
  console.log('\n--- JSON ---');
  console.log(JSON.stringify({ inputPath, outputPath, wordCount: wc, excerpt: ex }, null, 2));
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
