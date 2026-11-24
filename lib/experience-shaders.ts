import type { ProgramName } from "./experience";

// GLSL for the post intro backgrounds, shared by components/experience/ProceduralCanvas.tsx
// and the post video renderer (video/). Plain strings, no React, so Node can import it.

export const COMMON = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_seed;
uniform vec3 u_a;
uniform vec3 u_b;
uniform vec3 u_deep;
uniform vec4 u_k;
uniform float u_scale;
out vec4 outColor;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec2 hash2(vec2 p) { float n = hash(p); return vec2(n, hash(p + n + 17.17)); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}
vec3 bg() { return u_deep * 0.42; }
`;

export const SCENES: Record<ProgramName, string> = {
  // Topographic isolines over a domain-warped height field; the pointer raises a hill.
  contour: `
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  float t = u_time * u_k.w;
  vec2 so = vec2(u_seed * 17.13, u_seed * 7.77);
  vec2 p = uv * u_k.x + so;
  float hill = exp(-7.0 * dot(uv - u_mouse, uv - u_mouse));
  float h = fbm(p + fbm(p * 0.7 + t * 0.05) * u_k.y + t * 0.025) + hill * 0.22;
  float bands = h * u_k.z;
  float f = fract(bands);
  float w = fwidth(bands) * 1.2;
  float line = 1.0 - smoothstep(0.0, w, min(f, 1.0 - f));
  float major = mod(floor(bands + 0.5), 5.0) < 0.5 ? 1.0 : 0.0;
  float sweep = smoothstep(0.35, 0.0, abs(fract(h * 1.5 - t * 0.04) - 0.5));
  vec3 col = bg() + u_deep * 0.5 * h;
  vec3 ink = mix(u_b, u_a, smoothstep(0.3, 0.8, h));
  col += ink * line * (0.22 + 0.5 * major + 0.6 * sweep + 0.5 * hill);
  outColor = vec4(col, 1.0);
}`,
  // Domain-warped fbm (a slow nebula) with sparse stars.
  nebula: `
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  float t = u_time * u_k.w;
  vec2 so = vec2(u_seed * 11.3, u_seed * 3.1);
  vec2 p = uv * u_k.x + so;
  vec2 q = vec2(fbm(p + vec2(0.0, t * 0.04)), fbm(p + vec2(5.2, 1.3)));
  vec2 r = vec2(fbm(p + u_k.y * q + vec2(1.7, 9.2) + t * 0.05 + u_mouse * 0.6), fbm(p + u_k.y * q + vec2(8.3, 2.8)));
  float f = fbm(p + u_k.y * r);
  vec3 col = mix(bg(), u_deep * 1.7, clamp(f * f * 2.2, 0.0, 1.0));
  col = mix(col, u_b * 0.6, clamp(length(q) * 0.7 - 0.25, 0.0, 1.0) * 0.55);
  col = mix(col, u_a, smoothstep(0.58, 1.0, f) * u_k.z);
  vec2 sp = gl_FragCoord.xy / (2.0 * u_scale);
  float star = step(0.9965, hash(floor(sp) + so)) * (0.5 + 0.5 * sin(t * 2.0 + hash(floor(sp)) * 40.0));
  col += vec3(star) * 0.8;
  outColor = vec4(col, 1.0);
}`,
  // Stacked ridgelines drawn back to front, each one hiding the ones behind it.
  ridgelines: `
void main() {
  vec2 s = gl_FragCoord.xy / u_res;
  float t = u_time * u_k.w;
  float so = u_seed * 13.7;
  float n = floor(u_k.y);
  vec3 col = bg();
  float px = 1.6 / u_res.y;
  for (int i = 0; i < 40; i++) {
    float fi = float(i);
    if (fi >= n) break;
    float base = 0.92 - fi / n * 0.86;
    float env = smoothstep(0.08, 0.45, s.x) * smoothstep(0.92, 0.55, s.x);
    float d = max(fbm(vec2(s.x * u_k.x + so, fi * 0.41 + t * 0.12)) - 0.32, 0.0) * env * u_k.z * 1.6;
    d += exp(-60.0 * pow(s.x - (u_mouse.x * u_res.y / u_res.x + 0.5), 2.0)) * exp(-40.0 * pow(base - (u_mouse.y + 0.5), 2.0)) * 0.08;
    float y = base + d;
    if (s.y < y) col = bg() + u_deep * 0.25 * (fi / n);
    float line = 1.0 - smoothstep(0.0, px, abs(s.y - y));
    col = mix(col, mix(u_b, u_a, fi / n) * (0.55 + 0.45 * fi / n), line);
  }
  outColor = vec4(col, 1.0);
}`,
  // Drifting Voronoi cells with glowing edges; a few cells light up.
  cells: `
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  float t = u_time * u_k.w;
  vec2 so = vec2(u_seed * 9.1, u_seed * 4.3);
  vec2 p = uv * u_k.x + so;
  vec2 n = floor(p), f = fract(p);
  float f1 = 8.0, f2 = 8.0; vec2 id = vec2(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 o = 0.5 + 0.5 * sin(t * 0.35 + 6.2831 * hash2(n + g));
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < f1) { f2 = f1; f1 = d; id = n + g; } else if (d < f2) { f2 = d; }
  }
  float e = sqrt(f2) - sqrt(f1);
  float edge = 1.0 - smoothstep(0.0, u_k.y * u_scale + fwidth(e), e);
  float lit = step(1.0 - u_k.z * 0.35, hash(id + floor(t * 0.15)));
  float near = exp(-5.0 * dot(uv - u_mouse, uv - u_mouse));
  vec3 col = bg() + u_deep * 0.6 * (1.0 - sqrt(f1));
  col += u_b * lit * 0.18 * (1.0 - sqrt(f1));
  col += mix(u_b, u_a, near) * edge * (0.35 + 0.65 * near);
  outColor = vec4(col, 1.0);
}`,
  // Moving point sources summed into hard-edged moire bands.
  interference: `
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  float t = u_time * u_k.w;
  float so = u_seed * 6.28;
  float v = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 c = vec2(sin(t * 0.11 * (fi + 1.0) + fi * 2.1 + so), cos(t * 0.13 * (fi + 1.0) + fi * 1.3 + so)) * 0.6;
    if (i == 0) c = mix(c, u_mouse, 0.75);
    v += sin(length(uv - c) * u_k.x - t * 1.1);
  }
  v /= 4.0;
  float b = sin(v * 3.14159 * u_k.y);
  float band = smoothstep(-fwidth(b), fwidth(b), b);
  float fade = smoothstep(1.3, 0.1, length(uv));
  vec3 ink = mix(u_b, u_a, clamp(uv.x + 0.5, 0.0, 1.0));
  vec3 col = bg() + ink * band * (0.12 + 0.5 * fade) * (floor(u_k.z) / 5.0 + 0.2);
  outColor = vec4(col, 1.0);
}`,
  // A halftone dot screen over a drifting noise field.
  halftone: `
void main() {
  float cell = u_k.x * u_scale;
  vec2 g = gl_FragCoord.xy / cell;
  vec2 id = floor(g), f = fract(g) - 0.5;
  vec2 wp = ((id + 0.5) * cell - 0.5 * u_res) / u_res.y;
  float t = u_time * u_k.w;
  vec2 so = vec2(u_seed * 5.7, u_seed * 2.9);
  float h = fbm(wp * u_k.y + so + vec2(t * 0.05, -t * 0.03));
  h = smoothstep(0.32, 0.78, h);
  h = max(h, exp(-9.0 * dot(wp - u_mouse, wp - u_mouse)) * 0.9);
  float r = h * 0.5;
  float aa = 1.5 / cell;
  float dotm = 1.0 - smoothstep(r - aa, r + aa, length(f));
  vec3 col = mix(bg(), mix(u_b, u_a, h) * (0.4 + u_k.z), dotm * step(0.04, r));
  outColor = vec4(col, 1.0);
}`,
};

// Heavier programs render at a lower fraction of CSS pixels.
export const RES_SCALE: Record<ProgramName, number> = {
  contour: 0.6,
  nebula: 0.5,
  ridgelines: 0.6,
  cells: 0.75,
  interference: 0.75,
  halftone: 1,
};

export const VERT = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;
