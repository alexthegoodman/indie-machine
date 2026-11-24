// Renders the summary video for one post from video/storyboards/<slug>.json.
//
//   node video/build.mjs <slug> [--stills] [--voice af_heart] [--speed 1.1]
//
// --stills renders one PNG per scene (mid-scene) instead of the video.
// Output: video/out/<slug>/<slug>.mp4 + <slug>.jpg (poster), plus voice/ and
// audio intermediates (TTS clips are cached by text + voice + speed).
// Needs: ffmpeg on PATH, video/.venv with kokoro-onnx (see video/README.md),
// system Chrome, and playwright-core (PLAYWRIGHT_CORE=<dir> or resolvable).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { synthMusic, wavBytes, readWav } from "./music.mjs";
import { introScene, splitTitle } from "../lib/experience.ts";
import { COMMON, RES_SCALE, SCENES, VERT } from "../lib/experience-shaders.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const require = createRequire(import.meta.url);
const matter = require("gray-matter");

const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? def : args[i + 1];
};
const slug = args[0]?.startsWith("--") ? null : args[0];
if (!slug) {
  console.error("usage: node video/build.mjs <slug> [--stills] [--voice af_heart] [--speed 1.1]");
  process.exit(1);
}
const STILLS = args.includes("--stills");
const FPS = Number(flag("fps", 30));
const SITE = "indie-machine.com";

// ---------- post + storyboard ----------
const postFile = fs.readdirSync(path.join(ROOT, "app/posts")).find((f) => f.replace(/^\d{4}-\d{2}-\d{2}-/, "") === `${slug}.mdx`);
if (!postFile) throw new Error(`no post for slug ${slug}`);
const { data: fm, content } = matter(fs.readFileSync(path.join(ROOT, "app/posts", postFile), "utf8"));
const board = JSON.parse(fs.readFileSync(path.join(HERE, "storyboards", `${slug}.json`), "utf8"));
const kind = fm.kind ?? (fm.series === "Product Hunt" ? "product" : fm.series === "Game Announcements" ? "game" : "dev");
const voice = flag("voice", board.voice ?? "af_heart");
const speed = Number(flag("speed", board.speed ?? 1.1));
const outDir = path.join(HERE, "out", slug);
fs.mkdirSync(path.join(outDir, "voice"), { recursive: true });

const words = content.split(/\s+/).filter(Boolean).length;
const date = new Date(String(fm.date instanceof Date ? fm.date.toISOString().slice(0, 10) : fm.date) + "T12:00:00Z");
const dateText = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const { lead, tail } = splitTitle(String(fm.title));
const sectionFor = {
  product: { section: "REVIEW", chip: `Review  ·  ${fm.product?.category?.replace(/-/g, " ") ?? "product"}` },
  game: { section: "GAME DROP", chip: "Game announcement" },
  dev: { section: fm.series === "AI News" ? "AI NEWS" : `DEV LOG / ${String(fm.series ?? "Standalone").toUpperCase()}`, chip: fm.series === "AI News" ? "AI news" : `Dev log  ·  ${fm.series ?? "standalone"}` },
}[kind];
const meta = {
  lead,
  tail,
  section: sectionFor.section,
  chip: board.chip ?? sectionFor.chip,
  metaRow: [dateText, fm.series, `${words.toLocaleString("en-US")} words`, `${Math.max(1, Math.round(words / 230))} min read`].filter(Boolean).join("   ·   "),
  site: SITE,
  url: `${SITE}/posts/${slug}`,
};
const SCORE_LABELS = { usability: "Usability", accessibility: "Accessibility", security: "Security", performance: "Performance", setup_time: "Setup time" };

// ---------- narration ----------
const scenes = board.scenes.map((s) => ({ ...s }));
const lines = [];
scenes.forEach((s, i) => {
  if (!s.say) return;
  const text = s.speak ?? s.say;
  const key = crypto.createHash("sha1").update(`${voice}|${speed}|${text}`).digest("hex").slice(0, 12);
  s.wav = path.join(outDir, "voice", `${String(i).padStart(2, "0")}-${key}.wav`);
  if (!fs.existsSync(s.wav)) lines.push({ id: String(i), text, out: s.wav.replace(/\\/g, "/") });
});
if (lines.length) {
  const job = path.join(outDir, "voice", "job.json");
  fs.writeFileSync(job, JSON.stringify({ voice, speed, lines }));
  const py = path.join(HERE, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  console.log(`tts: ${lines.length} clip(s), voice ${voice}`);
  const r = spawnSync(py, [path.join(HERE, "tts.py"), job], { stdio: ["ignore", "inherit", "inherit"] });
  if (r.status !== 0) throw new Error("tts failed");
}

// ---------- timeline ----------
const VOICE_RATE = 24000;
const PAD = { intro: [1.7, 0.7, 5], point: [0.4, 0.55, 4], scores: [0.5, 1.4, 6], verdict: [0.5, 0.9, 5], outro: [0.9, 2.2, 5] };
let t = 0;
const clips = [];
for (const s of scenes) {
  const [lead, tailPad, min] = PAD[s.type];
  s.start = t;
  if (s.wav) {
    const { channels } = readWav(fs.readFileSync(s.wav));
    const x = channels[0];
    // Trim near-silence so captions line up with speech.
    const thr = 0.012;
    let a = 0, b = x.length - 1;
    while (a < b && Math.abs(x[a]) < thr) a++;
    while (b > a && Math.abs(x[b]) < thr) b--;
    const speech = x.subarray(a, b + 1);
    const at = t + lead;
    clips.push({ at, samples: speech });
    const dur = speech.length / VOICE_RATE;
    s.words = timeWords(s.say, at, dur);
    s.dur = Math.max(min, lead + dur + tailPad);
  } else {
    s.dur = s.dur ?? min;
  }
  t += s.dur;
}
const total = t;

// Spread caption words over the clip by length, with extra weight on pauses.
function timeWords(text, at, dur) {
  const ws = text.split(/\s+/).filter(Boolean);
  const weight = ws.map((w) => w.length + 2 + (/[.!?]$/.test(w) ? 5 : /[,;:]$/.test(w) ? 3 : 0));
  const sum = weight.reduce((a, b) => a + b, 0);
  let acc = 0;
  return ws.map((w, i) => {
    const t0 = at + (acc / sum) * dur;
    acc += weight[i];
    return { w, t0, t1: at + (acc / sum) * dur };
  });
}

// Voice track + per-frame envelope for the HUD waveform.
const voiceTrack = new Float32Array(Math.ceil((total + 0.5) * VOICE_RATE));
for (const c of clips) voiceTrack.set(c.samples, Math.round(c.at * VOICE_RATE));
const nFrames = Math.ceil(total * FPS);
const env = new Array(nFrames).fill(0);
const hop = VOICE_RATE / FPS;
for (let f = 0; f < nFrames; f++) {
  let sum = 0;
  const a = Math.floor(f * hop);
  for (let i = a; i < a + hop && i < voiceTrack.length; i++) sum += voiceTrack[i] * voiceTrack[i];
  env[f] = Math.sqrt(sum / hop);
}
const sorted = [...env].filter((e) => e > 0.005).sort((a, b) => a - b);
const ref = sorted[Math.floor(sorted.length * 0.95)] || 1;
for (let f = 0; f < nFrames; f++) env[f] = Math.round(Math.min(1, env[f] / ref) * 1000) / 1000;

// ---------- audio ----------
const scene0 = introScene({ slug, kind });
const voiceWav = path.join(outDir, "voice.wav");
const musicWav = path.join(outDir, "music.wav");
const audioWav = path.join(outDir, "audio.wav");
if (!STILLS) {
  fs.writeFileSync(voiceWav, wavBytes([voiceTrack], VOICE_RATE));
  const music = synthMusic({ seconds: total + 0.5, seed: scene0.seed });
  fs.writeFileSync(musicWav, wavBytes([music.L, music.R], music.rate));
  const filter = [
    "[1:a]aresample=48000,aformat=channel_layouts=stereo,asplit=2[v][sc]",
    "[0:a]aresample=48000,volume=0.30[m]",
    "[m][sc]sidechaincompress=threshold=0.015:ratio=6:attack=20:release=450[md]",
    "[md][v]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]",
  ].join(";");
  run("ffmpeg", ["-y", "-v", "error", "-i", musicWav, "-i", voiceWav, "-filter_complex", filter, "-map", "[a]", "-t", total.toFixed(3), audioWav]);
}

// ---------- render ----------
let n = 0;
for (const s of scenes) {
  if (s.type === "point") s.num = ++n;
  if (s.type === "scores") {
    s.scores = Object.entries(fm.scores ?? {}).map(([k, v]) => ({ label: SCORE_LABELS[k] ?? k.replace(/_/g, " "), value: Number(v) }));
    s.head ??= fm.product?.name ? `${fm.product.name}, scored` : "How it scored";
  }
  delete s.wav;
}
const config = {
  fps: FPS,
  total,
  seed: scene0.seed,
  palette: scene0.palette,
  params: scene0.params,
  shader: { common: COMMON, scene: SCENES[scene0.program], vert: VERT, resScale: RES_SCALE[scene0.program] },
  meta,
  scenes,
  env,
  assetBase: "http://video.local/public",
};

const pwDir = process.env.PLAYWRIGHT_CORE ?? [path.join(ROOT, "node_modules/playwright-core"), path.join(ROOT, "../hyperfield/node_modules/playwright-core")].find((d) => fs.existsSync(d));
if (!pwDir) throw new Error("playwright-core not found; set PLAYWRIGHT_CORE");
const { chromium } = await import(pathToFileURL(path.join(pwDir, "index.mjs")).href);
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const MIME = { ".html": "text/html", ".js": "text/javascript", ".woff": "font/woff", ".ttf": "font/ttf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".gif": "image/gif" };
// Serve the repo to the page under a fake origin so images don't taint the canvas.
await page.route("http://video.local/**", async (route) => {
  const rel = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\/+/, "");
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) return route.fulfill({ status: 404 });
  route.fulfill({ status: 200, body: fs.readFileSync(file), contentType: MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream" });
});
page.on("pageerror", (e) => console.error("page:", e));
page.on("console", (m) => m.type() === "error" && console.error("page:", m.text()));
await page.goto("http://video.local/video/renderer/index.html");
const ready = await page.evaluate((c) => window.VIDEO.setup(c), config);
if (!ready.fonts) console.warn("warning: fonts did not load");

const grab = async (time, q) => Buffer.from((await page.evaluate(([t, q]) => window.VIDEO.frame(t, q), [time, q])).split(",")[1], "base64");

if (STILLS) {
  const dir = path.join(outDir, "stills");
  fs.mkdirSync(dir, { recursive: true });
  for (const [i, s] of scenes.entries()) {
    const at = s.type === "intro" ? s.start + Math.min(s.dur - 0.4, 3.4) : s.start + Math.min(s.dur * 0.6, s.dur - 0.5);
    fs.writeFileSync(path.join(dir, `${String(i).padStart(2, "0")}-${s.type}.jpg`), await grab(at, 0.9));
  }
  console.log(`stills -> ${dir} (${total.toFixed(1)} s planned)`);
} else {
  const mp4 = path.join(outDir, `${slug}.mp4`);
  const ff = spawn("ffmpeg", ["-y", "-v", "error", "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", String(FPS), "-i", "-", "-i", audioWav,
    "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "medium", "-crf", "22", "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", mp4], { stdio: ["pipe", "inherit", "inherit"] });
  const started = performance.now();
  for (let f = 0; f < nFrames; f++) {
    const buf = await grab(f / FPS, 0.93);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (f % (FPS * 5) === 0) process.stdout.write(`\rframe ${f}/${nFrames}`);
  }
  ff.stdin.end();
  await new Promise((r, j) => ff.on("close", (code) => (code === 0 ? r() : j(new Error(`ffmpeg exited ${code}`)))));
  const intro = scenes[0];
  fs.writeFileSync(path.join(outDir, `${slug}.jpg`), await grab(intro.start + Math.min(intro.dur - 0.4, 3.4), 0.9));
  const secs = ((performance.now() - started) / 1000).toFixed(0);
  console.log(`\n${mp4}  ${total.toFixed(1)} s, ${nFrames} frames, rendered in ${secs} s, ${(fs.statSync(mp4).size / 1e6).toFixed(1)} MB`);
}
await browser.close();

function run(cmd, argv) {
  const r = spawnSync(cmd, argv, { stdio: ["ignore", "inherit", "inherit"] });
  if (r.status !== 0) throw new Error(`${cmd} failed`);
}
