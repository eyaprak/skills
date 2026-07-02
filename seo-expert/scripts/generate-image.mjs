#!/usr/bin/env node
/**
 * SEO Expert - Generate Featured Image (Pure Node.js, zero dependencies)
 * Usage: node generate-image.mjs "prompt text" [output-path]
 *
 * Generates a featured image via Google Gemini API (native fetch, no npm needed).
 * Saves the image locally as a PNG file.
 *
 * Requirements:
 *   - GOOGLE_GEMINI_API_KEY environment variable
 *   - Node.js v18+ (for native fetch)
 *
 * Output JSON:
 *   { success: true, imagePath: "output/slug/featured.png", mimeType: "image/png" }
 *   { success: false, error: "reason" }
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// ─── CONFIG ───────────────────────────────────────────────────────────────────

// Load API key from environment, or fall back to .env files (no npm needed)
async function loadApiKey() {
  if (process.env.GOOGLE_GEMINI_API_KEY) return process.env.GOOGLE_GEMINI_API_KEY;

  // Check these .env locations in priority order
  const candidates = [
    path.join(process.cwd(), '.env'),           // project .env
    path.join(os.homedir(), '.claude', '.env'), // ~/.claude/.env (Claude global)
    path.join(os.homedir(), '.env'),            // ~/.env
  ];

  for (const envFile of candidates) {
    try {
      const content = await fs.readFile(envFile, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
        const [key, ...rest] = trimmed.split('=');
        if (key.trim() === 'GOOGLE_GEMINI_API_KEY') {
          const value = rest.join('=').trim().replace(/^["']|["']$/g, '');
          if (value) {
            process.stderr.write(`Loaded GOOGLE_GEMINI_API_KEY from ${envFile}\n`);
            return value;
          }
        }
      }
    } catch {
      // file doesn't exist, try next
    }
  }

  return null;
}

let GEMINI_API_KEY = null; // resolved in main()

// Model that supports image generation output
const IMAGE_MODEL = 'gemini-2.0-flash-preview-image-generation';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// ─── STYLE TEMPLATE ───────────────────────────────────────────────────────────
// Produces consistent, professional tech infographic images suitable as blog headers.

function buildPrompt(subject) {
  return `Create a professional tech infographic blog header image. Subject: ${subject}.

Style requirements:
- Dark blue-purple gradient background with subtle digital/circuit pattern
- Clean infographic layout with the main concept visualized as connected nodes or flow diagram
- Accent colors: cyan and magenta glows on key elements
- Glassmorphism panels with semi-transparent overlays
- White text labels (minimal text, 3-5 words max if any)
- 16:9 aspect ratio composition
- Professional SaaS / modern tech aesthetic
- No watermarks, no borders, no photo-realistic style — vector/illustrative
- High contrast, visually striking for use as a blog featured image`;
}

// ─── GEMINI API CALL ──────────────────────────────────────────────────────────

async function generateImage(prompt) {
  const url = `${API_BASE}/${IMAGE_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const body = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT'],
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  // Extract image from response
  const candidates = data.candidates || [];
  for (const candidate of candidates) {
    const parts = candidate.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData?.mimeType?.startsWith('image/')) {
        return {
          data: part.inlineData.data,       // base64 string
          mimeType: part.inlineData.mimeType, // e.g. "image/png"
        };
      }
    }
  }

  throw new Error('No image in Gemini response. Response: ' + JSON.stringify(data).slice(0, 500));
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (!args[0]) {
    process.stderr.write('Usage: node generate-image.mjs "prompt" [output-path]\n');
    process.stderr.write('Example: node generate-image.mjs "n8n automation workflow" output/my-post/featured.png\n');
    process.stdout.write(JSON.stringify({ success: false, error: 'No prompt provided' }) + '\n');
    process.exit(1);
  }

  // Resolve API key from env or .env files
  GEMINI_API_KEY = await loadApiKey();

  if (!GEMINI_API_KEY) {
    process.stderr.write([
      '',
      'GOOGLE_GEMINI_API_KEY not found. To enable image generation:',
      '',
      '  Option 1 — Add to ~/.claude/.env (recommended, works for all projects):',
      '    echo \'GOOGLE_GEMINI_API_KEY=your_key_here\' >> ~/.claude/.env',
      '',
      '  Option 2 — Add to your project .env file:',
      '    echo \'GOOGLE_GEMINI_API_KEY=your_key_here\' >> .env',
      '',
      '  Get a free key at: https://aistudio.google.com',
      '',
      'Skipping image generation and continuing pipeline...',
      '',
    ].join('\n'));
    process.stdout.write(JSON.stringify({ success: false, error: 'GOOGLE_GEMINI_API_KEY not set' }) + '\n');
    process.exit(0); // Exit 0 so the pipeline continues without image
  }

  const subject = args[0];
  const outputPath = args[1] || `output/featured-${Date.now()}.png`;
  const fullOutputPath = path.isAbsolute(outputPath)
    ? outputPath
    : path.join(process.cwd(), outputPath);

  process.stderr.write(`\nGenerating featured image...\n`);
  process.stderr.write(`Subject: ${subject}\n`);
  process.stderr.write(`Output:  ${fullOutputPath}\n`);

  try {
    const prompt = buildPrompt(subject);
    const result = await generateImage(prompt);

    // Ensure output directory exists
    await fs.mkdir(path.dirname(fullOutputPath), { recursive: true });

    // Determine file extension from mimeType
    const ext = result.mimeType.split('/')[1] || 'png';
    const finalPath = fullOutputPath.endsWith(`.${ext}`)
      ? fullOutputPath
      : fullOutputPath.replace(/\.[^.]+$/, `.${ext}`);

    // Decode base64 and write file
    const imageBuffer = Buffer.from(result.data, 'base64');
    await fs.writeFile(finalPath, imageBuffer);

    const stats = await fs.stat(finalPath);
    const sizeKb = Math.round(stats.size / 1024);

    process.stderr.write(`\nImage saved: ${finalPath} (${sizeKb} KB)\n`);
    process.stderr.write(`MIME type:   ${result.mimeType}\n`);

    const output = {
      success: true,
      imagePath: path.relative(process.cwd(), finalPath),
      absolutePath: finalPath,
      mimeType: result.mimeType,
      sizeKb,
    };

    process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  } catch (err) {
    process.stderr.write(`\nImage generation failed: ${err.message}\n`);
    process.stdout.write(JSON.stringify({ success: false, error: err.message }) + '\n');
    process.exit(0); // Exit 0 so the pipeline continues without image
  }
}

main();
