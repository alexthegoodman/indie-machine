"use client";

import { useEffect, useRef } from "react";
import type { IntroScene } from "@/lib/experience";
import { COMMON, RES_SCALE, SCENES, VERT } from "@/lib/experience-shaders";

// The post intro's generative background: one full-screen fragment shader,
// picked and parameterised by the post's seed (see lib/experience.ts). It
// renders at reduced resolution, follows the pointer, pauses off screen or in
// a hidden tab, and draws a single still frame under reduced motion. Without
// WebGL2 it draws nothing and the CSS gradient underneath stays.

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("intro shader:", gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

export function ProceduralCanvas({ scene }: { scene: IntroScene }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "low-power" });
    if (!gl) return;
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, COMMON + SCENES[scene.program]);
    if (!vs || !fs) return;
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const u = (name: string) => gl.getUniformLocation(program, name);
    const uRes = u("u_res"), uTime = u("u_time"), uMouse = u("u_mouse"), uScale = u("u_scale");
    gl.uniform1f(u("u_seed"), (scene.seed % 10007) / 10007);
    gl.uniform3fv(u("u_a"), hexToRgb(scene.palette.accent));
    gl.uniform3fv(u("u_b"), hexToRgb(scene.palette.second));
    gl.uniform3fv(u("u_deep"), hexToRgb(scene.palette.deep));
    gl.uniform4fv(u("u_k"), scene.params);

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Start each post at its own point in time, so still frames differ too.
    const t0 = performance.now() - (scene.seed % 600) * 1000;
    const mouse = { x: 0.25, y: 0.1, tx: 0.25, ty: 0.1 };
    let scale = 1;
    let frame = 0;
    let frames = 0;
    let visible = true;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      scale = Math.min(window.devicePixelRatio || 1, 1.5) * RES_SCALE[scene.program];
      canvas.width = Math.max(1, Math.round(rect.width * scale));
      canvas.height = Math.max(1, Math.round(rect.height * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (still || !frame) draw(performance.now());
    };

    function draw(now: number) {
      mouse.x += (mouse.tx - mouse.x) * 0.06;
      mouse.y += (mouse.ty - mouse.y) * 0.06;
      gl!.uniform2f(uRes, canvas!.width, canvas!.height);
      gl!.uniform1f(uTime, (now - t0) / 1000);
      gl!.uniform2f(uMouse, mouse.x, mouse.y);
      gl!.uniform1f(uScale, scale);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
      frames += 1;
      canvas!.dataset.frames = String(frames);
      canvas!.dataset.ready = "true";
    }

    const loop = (now: number) => {
      frame = 0;
      if (!visible || document.hidden) return;
      draw(now);
      frame = requestAnimationFrame(loop);
    };
    const start = () => {
      if (!still && !frame && visible && !document.hidden) frame = requestAnimationFrame(loop);
    };

    const host = (canvas.closest(".exp-intro") as HTMLElement | null) ?? canvas.parentElement!;
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.tx = (e.clientX - rect.left - rect.width / 2) / rect.height;
      mouse.ty = -(e.clientY - rect.top - rect.height / 2) / rect.height;
      if (still) draw(performance.now());
    };
    host.addEventListener("pointermove", onMove);

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      start();
    });
    io.observe(canvas);
    const onVisibility = () => start();
    document.addEventListener("visibilitychange", onVisibility);

    resize();
    start();

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      host.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVisibility);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [scene]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      data-program={scene.program}
      className="exp-canvas absolute inset-0 h-full w-full opacity-20!"
    />
  );
}
