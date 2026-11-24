// Post video renderer. build.mjs loads this page in headless Chrome, calls
// VIDEO.setup(config) once, then VIDEO.frame(t) for every frame and pipes the
// returned JPEGs into ffmpeg. Everything is a pure function of t (no clocks,
// no Math.random), so a frame can be re-rendered on its own for previews.

(() => {
  const W = 1920, H = 1080, M = 96;
  const out = document.getElementById("out");
  const ctx = out.getContext("2d");
  const layer = new OffscreenCanvas(W, H);
  const lctx = layer.getContext("2d");
  const SANS = '"Space Grotesk", sans-serif';
  const MONO = '"IBM Plex Mono", monospace';
  const SERIF = '"Instrument Serif", serif';
  const WHITE = "#eef2f7";
  const DIM = "rgba(238,242,247,0.55)";
  const FAINT = "rgba(238,242,247,0.22)";
  let C = null; // config
  let gl = null, glCanvas = null, glU = null;
  let scan = null, grain = [];
  const images = new Map();

  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  const outCubic = (x) => 1 - Math.pow(1 - x, 3);
  const inOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const outBack = (x) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);
  function hash(a, b = 0) {
    let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
    h ^= h >>> 13; h = Math.imul(h, 0x27d4eb2f); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const rgba = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  function font(c, weight, size, family) { c.font = `${weight} ${size}px ${family}`; }
  function wrap(c, text, maxW) {
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    for (const w of words) {
      const next = line ? line + " " + w : w;
      if (line && c.measureText(next).width > maxW) { lines.push(line); line = w; } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  }
  // Largest size (stepping down) at which text wraps into <= maxLines and every line fits.
  function fit(c, text, { weight, family, max, min, maxW, maxLines }) {
    for (let s = max; s >= min; s -= 2) {
      font(c, weight, s, family);
      const lines = wrap(c, text, maxW);
      if (lines.length <= maxLines && lines.every((l) => c.measureText(l).width <= maxW)) return { size: s, lines };
    }
    font(c, weight, min, family);
    return { size: min, lines: wrap(c, text, maxW) };
  }
  // Scrambled-text decode: characters settle left to right as p goes 0 -> 1.
  const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+<>/\\=";
  function decode(text, p, salt) {
    let s = "";
    for (let i = 0; i < text.length; i++) {
      const settle = (i / text.length) * 0.75;
      if (text[i] === " " || p >= settle + 0.25) s += text[i];
      else if (p > settle - 0.1) s += GLYPHS[Math.floor(hash(i + salt, Math.floor(p * 40)) * GLYPHS.length)];
      else s += " ";
    }
    return s;
  }

  // ---------- background (the post's own intro shader) ----------
  function setupGL() {
    const s = C.shader.resScale;
    glCanvas = new OffscreenCanvas(Math.round(W * s), Math.round(H * s));
    gl = glCanvas.getContext("webgl2", { antialias: false, alpha: false, preserveDrawingBuffer: true });
    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      return sh;
    };
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, C.shader.vert));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, C.shader.common + C.shader.scene));
    gl.linkProgram(p);
    gl.useProgram(p);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(p, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = (n) => gl.getUniformLocation(p, n);
    const hex = (h) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
    gl.uniform1f(u("u_seed"), (C.seed % 10007) / 10007);
    gl.uniform3fv(u("u_a"), hex(C.palette.accent));
    gl.uniform3fv(u("u_b"), hex(C.palette.second));
    gl.uniform3fv(u("u_deep"), hex(C.palette.deep));
    gl.uniform4fv(u("u_k"), C.params);
    gl.uniform2f(u("u_res"), glCanvas.width, glCanvas.height);
    gl.uniform1f(u("u_scale"), s);
    gl.viewport(0, 0, glCanvas.width, glCanvas.height);
    glU = { time: u("u_time"), mouse: u("u_mouse") };
  }
  function drawBackground(t, strength) {
    gl.uniform1f(glU.time, (C.seed % 600) + t);
    gl.uniform2f(glU.mouse, 0.35 * Math.sin(t * 0.21), 0.18 * Math.cos(t * 0.17));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    ctx.fillStyle = "#040509";
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = strength;
    ctx.drawImage(glCanvas, 0, 0, W, H);
    ctx.globalAlpha = 1;
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 1.05);
    v.addColorStop(0, "rgba(4,5,9,0.15)");
    v.addColorStop(1, "rgba(4,5,9,0.85)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
    // Drifting HUD grid.
    ctx.strokeStyle = rgba(C.palette.accent, 0.045);
    ctx.lineWidth = 1;
    const g = 80, off = (t * 6) % g;
    ctx.beginPath();
    for (let x = -off; x < W; x += g) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = -off * 0.5; y < H; y += g) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
  }

  function makeOverlays() {
    scan = new OffscreenCanvas(W, H);
    const s = scan.getContext("2d");
    s.fillStyle = "rgba(0,0,0,0.10)";
    for (let y = 0; y < H; y += 3) s.fillRect(0, y, W, 1);
    for (let k = 0; k < 4; k++) {
      const g = new OffscreenCanvas(256, 256);
      const gc = g.getContext("2d");
      const img = gc.createImageData(256, 256);
      for (let i = 0; i < 256 * 256; i++) {
        const v = Math.floor(hash(i, k + 7) * 255);
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
        img.data[i * 4 + 3] = 255;
      }
      gc.putImageData(img, 0, 0);
      grain.push(g);
    }
  }

  // ---------- HUD chrome ----------
  function brackets(c, x, y, w, h, len, color, width = 2) {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    c.moveTo(x, y + len); c.lineTo(x, y); c.lineTo(x + len, y);
    c.moveTo(x + w - len, y); c.lineTo(x + w, y); c.lineTo(x + w, y + len);
    c.moveTo(x + w, y + h - len); c.lineTo(x + w, y + h); c.lineTo(x + w - len, y + h);
    c.moveTo(x + len, y + h); c.lineTo(x, y + h); c.lineTo(x, y + h - len);
    c.stroke();
  }
  function drawHud(t, si, frameIdx) {
    const a = prog(t, 0.6, 1.4) * (1 - prog(t, C.total - 1.0, C.total - 0.3));
    if (a <= 0) return;
    ctx.globalAlpha = a;
    brackets(ctx, 40, 40, W - 80, H - 80, 36, rgba(C.palette.accent, 0.5), 2);
    // Top left: mark + wordmark + section.
    ctx.fillStyle = C.palette.accent;
    ctx.save();
    ctx.translate(M + 9, 76);
    ctx.rotate(Math.PI / 4 + t * 0.4);
    ctx.fillRect(-7, -7, 14, 14);
    ctx.restore();
    font(ctx, 500, 20, MONO);
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = WHITE;
    ctx.fillText("INDIE MACHINE", M + 32, 77);
    const wm = ctx.measureText("INDIE MACHINE").width;
    ctx.fillStyle = DIM;
    ctx.fillText(`/  ${C.meta.section}`, M + 32 + wm + 16, 77);
    // Top right: rec + timecode + scene counter.
    ctx.textAlign = "right";
    ctx.fillStyle = DIM;
    const counter = `${String(si + 1).padStart(2, "0")}/${String(C.scenes.length).padStart(2, "0")}`;
    ctx.fillText(`${fmtTime(t)} / ${fmtTime(C.total)}    ${counter}`, W - M, 77);
    const tw = ctx.measureText(`${fmtTime(t)} / ${fmtTime(C.total)}    ${counter}`).width;
    ctx.fillStyle = WHITE;
    ctx.fillText("REC", W - M - tw - 24, 77);
    const rw = ctx.measureText("REC").width;
    if (Math.floor(t * 1.5) % 2 === 0) {
      ctx.fillStyle = "#ff4d5e";
      ctx.beginPath();
      ctx.arc(W - M - tw - 24 - rw - 16, 77, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    // Bottom: segmented progress.
    const y = H - 72, x0 = M, x1 = W - M, gap = 6;
    const segW = (x1 - x0 - gap * (C.scenes.length - 1)) / C.total;
    let x = x0;
    C.scenes.forEach((s, i) => {
      const w = s.dur * segW;
      ctx.fillStyle = FAINT;
      ctx.fillRect(x, y, w, 3);
      const p = clamp((t - s.start) / s.dur);
      if (p > 0) {
        ctx.fillStyle = i === si ? C.palette.accent : rgba(C.palette.accent, 0.55);
        ctx.fillRect(x, y, w * p, 3);
      }
      x += w + gap;
    });
    // Bottom left: narrator waveform from the voice envelope.
    const bars = 26;
    font(ctx, 500, 14, MONO);
    ctx.textAlign = "left";
    ctx.fillStyle = DIM;
    ctx.fillText("VOICE.SYNTH", M, H - 150);
    for (let i = 0; i < bars; i++) {
      const f = frameIdx - (bars - 1 - i) * 2;
      const e = f >= 0 && f < C.env.length ? C.env[f] : 0;
      const h = 3 + e * 34 * (0.6 + 0.4 * hash(i, Math.floor(frameIdx / 3)));
      ctx.fillStyle = rgba(C.palette.accent, 0.35 + 0.65 * e);
      ctx.fillRect(M + i * 7, H - 96 - h, 4, h);
    }
    // Bottom right: site.
    ctx.textAlign = "right";
    ctx.fillStyle = DIM;
    font(ctx, 500, 18, MONO);
    ctx.fillText(C.meta.site, W - M, H - 104);
    ctx.globalAlpha = 1;
  }

  // ---------- captions ----------
  function buildCaptionPages() {
    font(ctx, 500, 34, SANS);
    for (const s of C.scenes) {
      s.pages = [];
      if (!s.words?.length) continue;
      let cur = [];
      const flush = () => { if (cur.length) s.pages.push(cur); cur = []; };
      for (const w of s.words) {
        const test = [...cur, w].map((x) => x.w).join(" ");
        const lines = wrap(ctx, test, 1240);
        if (lines.length > 2) flush();
        cur.push(w);
        if (/[.!?]$/.test(w.w) && cur.length > 6) flush();
      }
      flush();
    }
  }
  function drawCaptions(t, scene) {
    const pages = scene.pages || [];
    let page = null;
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      const end = i + 1 < pages.length ? pages[i + 1][0].t0 - 0.05 : p[p.length - 1].t1 + 0.5;
      if (t >= p[0].t0 - 0.12 && t < end) page = p;
    }
    if (!page) return;
    font(ctx, 500, 34, SANS);
    const text = page.map((w) => w.w).join(" ");
    const lines = wrap(ctx, text, 1240);
    const lh = 46;
    const boxW = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 56;
    const boxH = lines.length * lh + 24;
    const bx = (W - boxW) / 2, by = H - 132 - boxH;
    ctx.fillStyle = "rgba(4,5,9,0.62)";
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.fillStyle = C.palette.accent;
    ctx.fillRect(bx, by, 4, boxH);
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    let wi = 0;
    lines.forEach((line, li) => {
      let x = (W - ctx.measureText(line).width) / 2;
      const y = by + 12 + lh * li + lh / 2;
      for (const word of line.split(" ")) {
        const w = page[wi++];
        const spoken = w && t >= w.t0;
        ctx.fillStyle = spoken ? WHITE : "rgba(238,242,247,0.38)";
        ctx.fillText(word, x, y);
        x += ctx.measureText(word + " ").width;
      }
    });
  }

  // ---------- scene pieces ----------
  // Lines slide up out of a mask, staggered.
  function revealLines(c, lines, x, y, lh, t, start, opts = {}) {
    lines.forEach((line, i) => {
      const p = outCubic(prog(t, start + i * 0.09, start + i * 0.09 + 0.6));
      if (p <= 0) return;
      c.save();
      c.beginPath();
      c.rect(x - 20, y + i * lh - lh * 0.2, W, lh * 1.12);
      c.clip();
      c.fillStyle = opts.color || WHITE;
      c.globalAlpha = p;
      const dx = opts.align === "center" ? (W - c.measureText(line).width) / 2 - x : 0;
      c.fillText(line, x + dx, y + i * lh + (1 - p) * lh * 0.9);
      c.restore();
    });
  }
  function kicker(c, t, num, label, x, y) {
    const p = prog(t, 0.05, 0.7);
    font(c, 500, 22, MONO);
    c.textBaseline = "top";
    c.textAlign = "left";
    c.fillStyle = C.palette.accent;
    const text = num ? `${num}  /  ${label.toUpperCase()}` : label.toUpperCase();
    c.fillText(decode(text, p, 3), x, y);
    c.fillRect(x, y + 36, 60 * outCubic(prog(t, 0.2, 0.8)), 3);
  }
  function ghostNumber(c, t, num, x, y) {
    font(c, 700, 300, SANS);
    c.textBaseline = "top";
    c.textAlign = "left";
    c.strokeStyle = rgba(C.palette.accent, 0.13 * prog(t, 0, 0.8));
    c.lineWidth = 2;
    c.strokeText(num, x - 12 + (1 - outCubic(prog(t, 0, 1.2))) * -40, y);
  }

  function panelFrame(c, x, y, w, h, t, label) {
    const p = outCubic(prog(t, 0.15, 0.75));
    c.fillStyle = "rgba(4,6,12,0.55)";
    c.fillRect(x, y, w, h * p);
    c.strokeStyle = rgba(C.palette.accent, 0.25 * p);
    c.lineWidth = 1;
    c.strokeRect(x + 0.5, y + 0.5, w - 1, h * p - 1);
    brackets(c, x - 8, y - 8, w + 16, h * p + 16, 26, rgba(C.palette.accent, 0.9 * p), 3);
    if (label) {
      font(c, 500, 16, MONO);
      c.textBaseline = "top";
      c.textAlign = "left";
      c.fillStyle = DIM;
      c.globalAlpha = prog(t, 0.6, 1);
      c.fillText(label.toUpperCase(), x, y + h + 22);
      c.globalAlpha = 1;
    }
  }

  function visualImage(c, v, t, dur, box) {
    const img = images.get(v.src);
    panelFrame(c, box.x, box.y, box.w, box.h, t, v.label);
    if (!img) return;
    const reveal = inOut(prog(t, 0.35, 1.25));
    const ia = img.width / img.height, ba = box.w / box.h;
    const cover = v.fit ? v.fit === "cover" : Math.abs(Math.log(ia / ba)) < 0.3;
    let dw, dh;
    if (cover === (ia > ba)) { dh = box.h; dw = dh * ia; } else { dw = box.w; dh = dw / ia; }
    const z = 1 + 0.06 * (t / dur);
    dw *= z; dh *= z;
    c.save();
    c.beginPath();
    c.rect(box.x, box.y, box.w, box.h * reveal);
    c.clip();
    c.drawImage(img, box.x + (box.w - dw) / 2, box.y + (box.h - dh) / 2, dw, dh);
    c.restore();
    if (reveal > 0 && reveal < 1) {
      const sy = box.y + box.h * reveal;
      const g = c.createLinearGradient(0, sy - 40, 0, sy);
      g.addColorStop(0, rgba(C.palette.accent, 0));
      g.addColorStop(1, rgba(C.palette.accent, 0.5));
      c.fillStyle = g;
      c.fillRect(box.x, sy - 40, box.w, 40);
      c.fillStyle = C.palette.accent;
      c.fillRect(box.x - 12, sy - 1, box.w + 24, 2);
    }
  }

  function visualStat(c, v, t, dur, box) {
    panelFrame(c, box.x, box.y, box.w, box.h, t, v.label);
    const cx = box.x + box.w / 2, cy = box.y + box.h * (v.sub ? 0.4 : 0.47);
    const r = Math.min(box.w, box.h) * (v.sub ? 0.29 : 0.34);
    // Rotating dashed ring + sweep arc.
    c.save();
    c.translate(cx, cy);
    c.rotate(t * 0.25);
    c.setLineDash([4, 10]);
    c.strokeStyle = rgba(C.palette.second, 0.45);
    c.lineWidth = 2;
    c.beginPath(); c.arc(0, 0, r + 22, 0, Math.PI * 2); c.stroke();
    c.restore();
    c.setLineDash([]);
    c.strokeStyle = C.palette.accent;
    c.lineWidth = 6;
    c.beginPath();
    c.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * inOut(prog(t, 0.3, 1.6)));
    c.stroke();
    // Counting number.
    const m = /^([^\d]*)([\d,]*\.?\d+)(.*)$/.exec(v.value);
    let shown = v.value;
    if (m) {
      const target = parseFloat(m[2].replace(/,/g, ""));
      const dec = (m[2].split(".")[1] || "").length;
      const val = target * outCubic(prog(t, 0.3, 1.5));
      let s = val.toFixed(dec);
      if (m[2].includes(",")) s = Number(s).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
      shown = m[1] + s + m[3];
    }
    const f = fit(c, shown, { weight: 700, family: SANS, max: 200, min: 60, maxW: r * 1.7, maxLines: 1 });
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.shadowColor = C.palette.accent;
    c.shadowBlur = 30;
    c.fillStyle = WHITE;
    c.fillText(shown, cx, cy - (v.unit ? 18 : 0));
    c.shadowBlur = 0;
    if (v.unit) {
      font(c, 500, 34, MONO);
      c.fillStyle = C.palette.accent;
      c.fillText(v.unit.toUpperCase(), cx, cy + f.size * 0.42);
    }
    if (v.sub) {
      const p = prog(t, 1.3, 1.9);
      c.globalAlpha = p;
      const s = fit(c, v.sub, { weight: 500, family: SANS, max: 32, min: 22, maxW: box.w - 80, maxLines: 2 });
      c.fillStyle = C.palette.second;
      s.lines.forEach((l, i) => c.fillText(l, cx, cy + r + 56 + i * s.size * 1.2));
      c.globalAlpha = 1;
    }
  }

  function visualBars(c, v, t, dur, box) {
    panelFrame(c, box.x, box.y, box.w, box.h, t, v.label);
    const items = v.items;
    const max = Math.max(...items.map((i) => i.value));
    const padX = 40;
    const rowH = Math.min(150, (box.h - 80) / items.length);
    const top = box.y + (box.h - rowH * items.length) / 2 + 10;
    const barMax = box.w - padX * 2;
    items.forEach((it, i) => {
      const p = outCubic(prog(t, 0.5 + i * 0.18, 1.5 + i * 0.18));
      const y = top + i * rowH;
      const hi = it.highlight ?? i === 0;
      font(c, 500, 22, MONO);
      c.textAlign = "left";
      c.textBaseline = "top";
      c.fillStyle = hi ? WHITE : DIM;
      c.globalAlpha = prog(t, 0.3 + i * 0.18, 0.8 + i * 0.18);
      c.fillText(it.label.toUpperCase(), box.x + padX, y);
      const frac = v.log ? Math.log10(1 + it.value) / Math.log10(1 + max) : it.value / max;
      const bw = Math.max(6, barMax * frac * p);
      c.fillStyle = hi ? C.palette.accent : rgba(C.palette.second, 0.55);
      if (hi) { c.shadowColor = C.palette.accent; c.shadowBlur = 18; }
      c.fillRect(box.x + padX, y + 34, bw, rowH * 0.32);
      c.shadowBlur = 0;
      font(c, 700, 30, SANS);
      c.fillStyle = hi ? C.palette.accent : WHITE;
      const label = it.display ?? `${it.value}${v.unit ? " " + v.unit : ""}`;
      const lw = c.measureText(label).width;
      const lx = box.x + padX + bw + 14 + lw > box.x + box.w - 20 ? box.x + padX + bw - lw - 12 : box.x + padX + bw + 14;
      if (lx < box.x + padX + bw) c.fillStyle = "#05070c";
      c.fillText(label, lx, y + 34 + rowH * 0.16 - 17);
      c.globalAlpha = 1;
    });
  }

  const KEYWORDS = /\b(fn|let|const|mut|pub|use|struct|impl|return|if|else|for|while|match|async|await|import|export|from|function|new|type|var|in|of|class)\b/;
  function visualCode(c, v, t, dur, box) {
    panelFrame(c, box.x, box.y, box.w, box.h, t, v.label);
    const p = prog(t, 0.6, 0.6 + Math.min(dur * 0.55, 5.5));
    c.fillStyle = "rgba(0,0,0,0.35)";
    c.fillRect(box.x, box.y, box.w, 40);
    ["#ff5f57", "#febc2e", "#28c840"].forEach((col, i) => {
      c.fillStyle = col;
      c.beginPath(); c.arc(box.x + 22 + i * 20, box.y + 20, 6, 0, Math.PI * 2); c.fill();
    });
    font(c, 500, 16, MONO);
    c.textAlign = "left";
    c.textBaseline = "middle";
    c.fillStyle = DIM;
    if (v.file) c.fillText(v.file, box.x + 90, box.y + 21);
    const lines = v.lines;
    const total = lines.reduce((s, l) => s + l.length + 1, 0);
    let budget = Math.floor(total * p);
    const size = v.size || 21;
    font(c, 500, size, MONO);
    const lh = size * 1.5;
    c.textBaseline = "top";
    let cursor = null;
    for (let i = 0; i < lines.length; i++) {
      if (budget <= 0) break;
      const shown = lines[i].slice(0, budget);
      budget -= lines[i].length + 1;
      const y = box.y + 62 + i * lh;
      if (y > box.y + box.h - lh) break;
      // Token tint: comments, strings, keywords, numbers.
      let x = box.x + 28;
      const toks = shown.split(/(\/\/.*$|#\s.*$|"[^"]*"?|'[^']*'?|\b\w+\b|\s+|.)/).filter(Boolean);
      for (const tok of toks) {
        c.fillStyle = tok.startsWith("//") || tok.startsWith("# ") ? "rgba(238,242,247,0.4)"
          : /^["']/.test(tok) ? C.palette.second
          : KEYWORDS.test(tok) && /^\w+$/.test(tok) ? C.palette.accent
          : /^\d/.test(tok) ? "#ffd166" : WHITE;
        c.fillText(tok, x, y);
        x += c.measureText(tok).width;
      }
      cursor = { x, y };
    }
    if (cursor && Math.floor(t * 2.5) % 2 === 0) {
      c.fillStyle = C.palette.accent;
      c.fillRect(cursor.x + 2, cursor.y, size * 0.55, size * 1.1);
    }
  }

  function visualList(c, v, t, dur, box) {
    const items = v.items;
    const step = Math.min(0.5, (dur * 0.5) / items.length);
    let y = box.y + 10;
    items.forEach((it, i) => {
      const p = outCubic(prog(t, 0.5 + i * step, 1.1 + i * step));
      const f = fit(c, it, { weight: 500, family: SANS, max: 38, min: 26, maxW: box.w - 70, maxLines: 2 });
      c.globalAlpha = p;
      c.textAlign = "left";
      c.textBaseline = "top";
      c.fillStyle = C.palette.accent;
      c.fillRect(box.x + (1 - p) * 40, y + f.size * 0.45, 14, 14);
      c.fillStyle = WHITE;
      f.lines.forEach((l, li) => c.fillText(l, box.x + 44 + (1 - p) * 40, y + li * f.size * 1.2));
      c.strokeStyle = FAINT;
      c.lineWidth = 1;
      const bottom = y + f.lines.length * f.size * 1.2 + 22;
      c.beginPath(); c.moveTo(box.x + 44, bottom); c.lineTo(box.x + 44 + (box.w - 44) * p, bottom); c.stroke();
      y = bottom + 26;
      c.globalAlpha = 1;
    });
  }

  function visualChips(c, v, t, dur, box) {
    let x = box.x, y = box.y + 20;
    v.items.forEach((it, i) => {
      const p = outBack(prog(t, 0.5 + i * 0.15, 1.0 + i * 0.15));
      font(c, 500, 26, MONO);
      const w = c.measureText(it.toUpperCase()).width + 48;
      if (x + w > box.x + box.w) { x = box.x; y += 80; }
      c.save();
      c.globalAlpha = clamp(p);
      c.translate(x + w / 2, y + 28);
      c.scale(0.6 + 0.4 * p, 0.6 + 0.4 * p);
      c.strokeStyle = i % 2 ? C.palette.second : C.palette.accent;
      c.lineWidth = 2;
      c.beginPath(); c.roundRect(-w / 2, -28, w, 56, 28); c.stroke();
      c.fillStyle = WHITE;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(it.toUpperCase(), 0, 1);
      c.restore();
      x += w + 18;
    });
  }

  const VISUALS = { image: visualImage, stat: visualStat, bars: visualBars, code: visualCode, list: visualList, chips: visualChips };

  // ---------- scenes ----------
  function sceneIntro(c, s, t) {
    // Boot: wordmark decodes in the middle, then gives way to the title.
    const boot = 1 - prog(t, 1.0, 1.4);
    if (boot > 0) {
      c.globalAlpha = boot;
      font(c, 500, 30, MONO);
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillStyle = WHITE;
      c.fillText(decode("I N D I E   M A C H I N E", prog(t, 0.05, 0.8), 11), W / 2, H / 2);
      c.fillStyle = C.palette.accent;
      const lw = 520 * inOut(prog(t, 0.1, 0.7));
      c.fillRect(W / 2 - lw / 2, H / 2 + 34, lw, 2);
      c.globalAlpha = 1;
    }
    const t2 = t - 1.1;
    if (t2 < 0) return;
    const x = M + 40;
    // Chip.
    font(c, 500, 22, MONO);
    const chip = C.meta.chip.toUpperCase();
    const cw = c.measureText(chip).width + 36;
    const cp = outCubic(prog(t2, 0, 0.5));
    c.globalAlpha = cp;
    c.strokeStyle = C.palette.accent;
    c.lineWidth = 2;
    c.beginPath(); c.roundRect(x, 230, cw * cp, 44, 22); c.stroke();
    c.fillStyle = C.palette.accent;
    c.textAlign = "left";
    c.textBaseline = "middle";
    c.fillText(decode(chip, prog(t2, 0.1, 0.7), 5), x + 18, 253);
    c.globalAlpha = 1;
    // Title lead + tail.
    const lead = fit(c, C.meta.lead, { weight: 700, family: SANS, max: 128, min: 56, maxW: W - 2 * x, maxLines: 3 });
    c.textBaseline = "top";
    const lh = lead.size * 1.04;
    let y = 310;
    revealLines(c, lead.lines, x, y, lh, t2, 0.15);
    y += lead.lines.length * lh + 10;
    if (C.meta.tail) {
      const tail = fit(c, C.meta.tail, { weight: "italic 400", family: SERIF, max: Math.round(lead.size * 0.8), min: 44, maxW: W - 2 * x, maxLines: 2 });
      revealLines(c, tail.lines, x, y, tail.size * 1.08, t2, 0.45, { color: C.palette.accent });
      y += tail.lines.length * tail.size * 1.08;
    }
    // Meta row.
    font(c, 500, 22, MONO);
    c.fillStyle = DIM;
    c.globalAlpha = prog(t2, 0.9, 1.4);
    c.fillText(C.meta.metaRow.toUpperCase(), x, Math.min(y + 34, 860));
    c.globalAlpha = 1;
  }

  function scenePoint(c, s, t) {
    const v = s.visual;
    const hasPanel = v && v.kind !== "list" && v.kind !== "chips";
    const x = M + 40;
    const colW = v ? 780 : W - 2 * x;
    const num = String(s.num).padStart(2, "0");
    ghostNumber(c, t, num, x, 150);
    kicker(c, t, num, s.kicker || "", x, 250);
    const head = fit(c, s.head, { weight: 700, family: SANS, max: v ? 76 : 104, min: 40, maxW: colW, maxLines: v ? 5 : 3 });
    c.textBaseline = "top";
    revealLines(c, head.lines, x, 320, head.size * 1.08, t, 0.2);
    const endY = 320 + head.lines.length * head.size * 1.08 + 26;
    c.fillStyle = rgba(C.palette.accent, 0.8);
    c.fillRect(x, endY, colW * 0.3 * inOut(prog(t, 0.6, 1.3)), 2);
    if (s.sub) {
      const sub = fit(c, s.sub, { weight: 500, family: SANS, max: 32, min: 24, maxW: colW, maxLines: 3 });
      c.fillStyle = DIM;
      c.globalAlpha = prog(t, 0.9, 1.4);
      sub.lines.forEach((l, i) => c.fillText(l, x, endY + 30 + i * sub.size * 1.3));
      c.globalAlpha = 1;
    }
    if (!v) return;
    const box = hasPanel ? { x: 1000, y: 190, w: 800, h: 560 } : { x: 1000, y: 230, w: 800, h: 560 };
    VISUALS[v.kind](c, v, t, s.dur, box);
  }

  function sceneScores(c, s, t) {
    const x = M + 40;
    kicker(c, t, null, s.kicker || "Scorecard", x, 180);
    const rows = s.scores;
    font(c, 700, 64, SANS);
    c.textBaseline = "top";
    revealLines(c, [s.head || "How it scored"], x, 226, 70, t, 0.1);
    const top = 340, rowH = Math.min(96, 470 / rows.length);
    rows.forEach((r, i) => {
      const y = top + i * rowH;
      const p = prog(t, 0.5 + i * 0.22, 1.3 + i * 0.22);
      font(c, 500, 24, MONO);
      c.textAlign = "left";
      c.textBaseline = "middle";
      c.globalAlpha = prog(t, 0.3 + i * 0.22, 0.7 + i * 0.22);
      c.fillStyle = WHITE;
      c.fillText(r.label.toUpperCase(), x, y + 20);
      for (let k = 0; k < 10; k++) {
        const on = k < Math.round(r.value * p);
        const col = r.value >= 8 ? C.palette.accent : r.value >= 3 ? C.palette.second : "#ff4d5e";
        c.fillStyle = on ? col : "rgba(238,242,247,0.08)";
        if (on) { c.shadowColor = col; c.shadowBlur = 12; }
        c.fillRect(x + 330 + k * 50, y + 4, 40, 32);
        c.shadowBlur = 0;
      }
      font(c, 700, 40, SANS);
      c.fillStyle = WHITE;
      c.fillText((r.value * outCubic(p)).toFixed(0), x + 860, y + 20);
      c.globalAlpha = 1;
    });
    // Overall ring.
    const avg = rows.reduce((a, r) => a + r.value, 0) / rows.length;
    const cx = 1540, cy = 560, R = 190;
    const p = inOut(prog(t, 0.8, 2.6));
    c.strokeStyle = "rgba(238,242,247,0.1)";
    c.lineWidth = 16;
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = C.palette.accent;
    c.shadowColor = C.palette.accent;
    c.shadowBlur = 24;
    c.beginPath(); c.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * avg * p) / 10); c.stroke();
    c.shadowBlur = 0;
    font(c, 700, 120, SANS);
    c.textAlign = "center";
    c.fillStyle = WHITE;
    c.fillText((avg * p).toFixed(1), cx, cy - 6);
    font(c, 500, 22, MONO);
    c.fillStyle = DIM;
    c.fillText("OVERALL / 10", cx, cy + 74);
  }

  function sceneVerdict(c, s, t) {
    const x = M + 40;
    kicker(c, t, null, s.kicker || "The verdict", x, 200);
    const head = fit(c, s.head, { weight: 700, family: SANS, max: 84, min: 44, maxW: W - 2 * x, maxLines: 3 });
    c.textBaseline = "top";
    revealLines(c, head.lines, x, 260, head.size * 1.08, t, 0.15);
    const cards = [
      s.pros && { title: s.prosTitle || "Favorite feature", text: s.pros, col: C.palette.accent, mark: "+" },
      s.cons && { title: s.consTitle || "Would change", text: s.cons, col: C.palette.second, mark: "!" },
    ].filter(Boolean);
    const cw = (W - 2 * x - 40) / 2;
    const cy = Math.max(470, 260 + head.lines.length * head.size * 1.08 + 60);
    cards.forEach((card, i) => {
      const p = outCubic(prog(t, 1.0 + i * 0.5, 1.6 + i * 0.5));
      if (p <= 0) return;
      const cx = x + i * (cw + 40);
      c.globalAlpha = p;
      c.save();
      c.translate(0, (1 - p) * 30);
      c.fillStyle = "rgba(4,6,12,0.6)";
      c.fillRect(cx, cy, cw, 230);
      c.fillStyle = card.col;
      c.fillRect(cx, cy, 4, 230);
      font(c, 500, 20, MONO);
      c.textAlign = "left";
      c.textBaseline = "top";
      c.fillText(`[${card.mark}] ${card.title.toUpperCase()}`, cx + 32, cy + 28);
      const f = fit(c, card.text, { weight: 500, family: SANS, max: 36, min: 24, maxW: cw - 64, maxLines: 4 });
      c.fillStyle = WHITE;
      f.lines.forEach((l, li) => c.fillText(l, cx + 32, cy + 76 + li * f.size * 1.25));
      c.restore();
      c.globalAlpha = 1;
    });
  }

  function sceneOutro(c, s, t) {
    c.textAlign = "center";
    c.textBaseline = "middle";
    font(c, 700, 132, SANS);
    c.fillStyle = WHITE;
    c.shadowColor = C.palette.accent;
    c.shadowBlur = 40 * prog(t, 0.4, 1.2);
    c.fillText(decode("INDIE MACHINE", prog(t, 0.1, 1.0), 21), W / 2, 410);
    c.shadowBlur = 0;
    const p = outCubic(prog(t, 0.7, 1.3));
    c.globalAlpha = p;
    font(c, "italic 400", 64, SERIF);
    c.fillStyle = C.palette.accent;
    c.fillText(s.head || "Read the full post", W / 2, 530 + (1 - p) * 20);
    const url = C.meta.url;
    const f = fit(c, url, { weight: 500, family: MONO, max: 30, min: 18, maxW: W - 300, maxLines: 1 });
    c.fillStyle = WHITE;
    c.globalAlpha = prog(t, 1.1, 1.6);
    c.fillText(url, W / 2, 620);
    c.strokeStyle = rgba(C.palette.accent, 0.6);
    const uw = c.measureText(url).width;
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(W / 2 - uw / 2, 648); c.lineTo(W / 2 - uw / 2 + uw * inOut(prog(t, 1.3, 2.0)), 648); c.stroke();
    c.globalAlpha = 1;
  }

  const SCENES = { intro: sceneIntro, point: scenePoint, scores: sceneScores, verdict: sceneVerdict, outro: sceneOutro };
  const BG = { intro: 0.95, outro: 0.9, point: 0.28, scores: 0.22, verdict: 0.34 };

  function sceneAt(t) {
    let i = C.scenes.findIndex((s) => t >= s.start && t < s.start + s.dur);
    if (i < 0) i = t < 0 ? 0 : C.scenes.length - 1;
    return i;
  }

  function frame(t) {
    const fi = Math.round(t * C.fps);
    const si = sceneAt(t);
    const s = C.scenes[si];
    const lt = t - s.start;
    // Background strength eases between scene types.
    const prev = C.scenes[si - 1];
    const k = prev ? inOut(prog(lt, 0, 0.8)) : 1;
    drawBackground(t, (prev ? BG[prev.type] : BG[s.type]) * (1 - k) + BG[s.type] * k);

    lctx.clearRect(0, 0, W, H);
    lctx.save();
    SCENES[s.type](lctx, s, lt);
    lctx.restore();
    // Exit fade and glitch-in.
    const exit = s.type === "outro" ? 1 : 1 - prog(lt, s.dur - 0.35, s.dur);
    const g = si > 0 ? 1 - prog(lt, 0, 0.32) : 0;
    ctx.globalAlpha = exit;
    if (g > 0) {
      const bands = 16;
      for (let b = 0; b < bands; b++) {
        const y0 = (H / bands) * b;
        const dx = (hash(b, fi) - 0.5) * 160 * g * g;
        ctx.drawImage(layer, 0, y0, W, H / bands, dx, y0, W, H / bands);
      }
      ctx.globalAlpha = 0.35 * g;
      ctx.globalCompositeOperation = "screen";
      ctx.drawImage(layer, 14 * g, 0);
      ctx.globalCompositeOperation = "source-over";
    } else {
      ctx.drawImage(layer, 0, (1 - exit) * -16);
    }
    ctx.globalAlpha = 1;

    drawHud(t, si, fi);
    drawCaptions(t, s);

    ctx.drawImage(scan, 0, 0);
    ctx.globalAlpha = 0.045;
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = ctx.createPattern(grain[Math.floor(fi / 3) % grain.length], "repeat");
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    // Fade in from / out to black.
    const black = Math.max(1 - prog(t, 0, 0.4), prog(t, C.total - 0.7, C.total));
    if (black > 0) {
      ctx.fillStyle = `rgba(0,0,0,${black})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  async function setup(config) {
    C = config;
    await Promise.all([
      document.fonts.load('700 40px "Space Grotesk"'),
      document.fonts.load('500 40px "Space Grotesk"'),
      document.fonts.load('500 40px "IBM Plex Mono"'),
      document.fonts.load('italic 400 40px "Instrument Serif"'),
    ]);
    for (const s of C.scenes) {
      const src = s.visual?.kind === "image" ? s.visual.src : null;
      if (src && !images.has(src)) {
        const img = new Image();
        img.src = C.assetBase + src;
        await img.decode();
        images.set(src, img);
      }
    }
    setupGL();
    makeOverlays();
    buildCaptionPages();
    return { fonts: document.fonts.check('700 40px "Space Grotesk"') && document.fonts.check('italic 400 40px "Instrument Serif"') };
  }

  window.VIDEO = {
    setup,
    frame(t, quality = 0.92) { frame(t); return out.toDataURL("image/jpeg", quality); },
  };
})();
