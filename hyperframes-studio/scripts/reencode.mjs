#!/usr/bin/env node
/**
 * reencode.mjs — dense-keyframe re-encode for RAW talking-head / demo clips.
 *
 * Raw screen/webcam recordings have sparse keyframes, which make the HyperFrames
 * render freeze or seek to the wrong frame. This produces a copy with a keyframe
 * every 30 frames (audio stream copied untouched), safe to use in a composition.
 *
 * Usage:  node reencode.mjs <in.mp4> [out.mp4]
 *         (out defaults to "<in>-src.mp4")
 *
 * No network, no secrets. Requires ffmpeg on PATH.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const [, , inArg, outArg] = process.argv;

if (!inArg || inArg === "-h" || inArg === "--help") {
  console.error("Usage: node reencode.mjs <in.mp4> [out.mp4]   (out defaults to <in>-src.mp4)");
  process.exit(inArg ? 0 : 1);
}

if (!existsSync(inArg)) {
  console.error(`[reencode] Input not found: ${inArg}`);
  process.exit(1);
}

// ffmpeg present?
if (spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status !== 0) {
  console.error("[reencode] ffmpeg not found on PATH. Install ffmpeg and try again.");
  process.exit(1);
}

const ext = path.extname(inArg);
const out = outArg || inArg.slice(0, inArg.length - ext.length) + "-src" + (ext || ".mp4");

const args = [
  "-i", inArg,
  "-c:v", "libx264", "-crf", "18", "-preset", "medium",
  "-g", "30", "-keyint_min", "30", "-sc_threshold", "0",
  "-pix_fmt", "yuv420p",
  "-c:a", "copy",
  out,
];

console.error(`[reencode] ${inArg} -> ${out}`);
const r = spawnSync("ffmpeg", args, { stdio: "inherit" });
if (r.status !== 0) {
  console.error("[reencode] ffmpeg failed.");
  process.exit(r.status || 1);
}
console.error(`[reencode] done: ${out}`);
