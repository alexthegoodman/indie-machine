// Yumon's robot body: a Meshy-made, Meshy-rigged humanoid with six library clips, drawn with
// Three.js on a transparent canvas. Imported only by components/mascot/YumonMascot.tsx, and
// only once the stage scrolls into view, so three.js stays out of the page bundle.
//
// Both variants are one GLB each in public/models/mascot/ (mesh, 24-joint skin, one texture,
// all six clips); assets/mascot/ keeps the Meshy sources and their task trails.
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";

export type Variant = "bot" | "mech";
export type Clip = "idle" | "wave" | "think" | "talk" | "cheer" | "doze";

export const VARIANTS: Record<Variant, { url: string; label: string; metalness: number; roughness: number }> = {
  bot: { url: "/models/mascot/yumon-bot.glb", label: "SOFT", metalness: 0, roughness: 0.55 },
  mech: { url: "/models/mascot/yumon-mech.glb", label: "MECH", metalness: 0.45, roughness: 0.38 },
};

/** Meshy animation library names, as baked into the GLBs (action ids 0, 28, 36, 313, 49, 38). */
const CLIP_NAMES: Record<Clip, string> = {
  idle: "Idle",
  wave: "Big_Wave_Hello",
  think: "Confused_Scratch",
  talk: "Talk_with_Hands_Open",
  cheer: "Motivational_Cheer",
  doze: "Dozing_Elderly",
};

/** One-shots play faster than authored; the library's cheer alone is 9 s. */
const ONE_SHOT_SPEED: Partial<Record<Clip, number>> = { wave: 1.15, cheer: 1.6 };
const FADE = 0.35;

const gltfs = new Map<Variant, Promise<GLTF>>();

function loadVariant(v: Variant): Promise<GLTF> {
  let p = gltfs.get(v);
  if (!p) {
    p = new GLTFLoader().loadAsync(VARIANTS[v].url);
    // A failed download can be retried on the next mount.
    p.catch(() => gltfs.delete(v));
    gltfs.set(v, p);
  }
  return p;
}

export type MascotScene = {
  /** The looping clip to rest in. */
  setBase(c: Clip): void;
  /** Play a clip once, then fade back to the base clip. */
  play(c: Clip): void;
  /** Render continuously while on screen; off screen it draws nothing. */
  setActive(on: boolean): void;
  dispose(): void;
};

export async function createMascot(
  canvas: HTMLCanvasElement,
  variant: Variant,
  opts: { still: boolean; base: Clip },
): Promise<MascotScene> {
  const gltf = await loadVariant(variant);
  const cfg = VARIANTS[variant];

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envTarget.texture;
  pmrem.dispose();

  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(1.5, 2.5, 2);
  // Brand-cyan rim from behind, so the silhouette reads against the dark page.
  const rim = new THREE.DirectionalLight(0x4fd8ff, 2.2);
  rim.position.set(-1.5, 1.5, -2);
  scene.add(key, rim, new THREE.HemisphereLight(0xdbeafe, 0x0a0a0a, 0.35));

  const root = cloneSkinned(gltf.scene);
  let height = 1;
  root.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    m.frustumCulled = false; // bind-pose bounds don't cover a wave or a cheer
    m.geometry.computeBoundingBox();
    height = m.geometry.boundingBox!.max.y;
    // Meshy N1 bakes base color only; the mech gets some metal so it catches the environment.
    const mat = (m.material as THREE.MeshStandardMaterial).clone();
    mat.metalness = cfg.metalness;
    mat.roughness = cfg.roughness;
    mat.side = THREE.FrontSide;
    m.material = mat;
  });
  // Both robots stand one unit tall, whatever height they were rigged at.
  root.scale.setScalar(1 / height);
  scene.add(root);

  // Waist-up portrait that follows the top of the head (the rig's head_end bone), so a crouch,
  // a doze or a lean stays in frame. The stage is short; a full body left the robot tiny.
  const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 20);
  const target = new THREE.Vector3(0, 0.8, 0);
  const headTop = root.getObjectByName("head_end") ?? root.getObjectByName("Head");
  const headPos = new THREE.Vector3();
  let dist = 2;

  function frame() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Fit 0.64 units of height (waist to just over the head), and 0.7 of width on narrow stages.
    const fitH = 0.32 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const fitW = 0.35 / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
    dist = Math.max(fitH, fitW);
    camera.updateProjectionMatrix();
    aim(1);
  }

  /** Move the frame toward the head; `k` = 1 snaps, smaller eases. */
  function aim(k: number) {
    if (headTop) {
      root.updateMatrixWorld(true);
      headTop.getWorldPosition(headPos);
      target.x += (headPos.x * 0.5 - target.x) * k;
      target.y += (headPos.y - 0.2 - target.y) * k;
    }
    camera.position.set(target.x + dist * 0.15, target.y + 0.04, dist);
    camera.lookAt(target);
  }

  // Library clips walk the hips a little; keep the robot on its spot.
  let hips: THREE.Object3D | undefined;
  root.traverse((o) => {
    if (!hips && o.name === "Hips") hips = o;
  });
  const hipsHome = hips?.position.clone();

  const mixer = new THREE.AnimationMixer(root);
  const actions = new Map<Clip, THREE.AnimationAction>();
  for (const [c, name] of Object.entries(CLIP_NAMES) as [Clip, string][]) {
    const clip = gltf.animations.find((a) => a.name === name);
    if (clip) actions.set(c, mixer.clipAction(clip));
  }

  let base: Clip = opts.base;
  let current: THREE.AnimationAction | undefined;
  let oneShot: Clip | null = null;

  function fadeTo(next: THREE.AnimationAction) {
    if (next === current) return;
    next.enabled = true;
    next.setEffectiveWeight(1);
    if (current) next.crossFadeFrom(current, opts.still ? 0 : FADE, false);
    next.play();
    current = next;
  }

  function startBase() {
    const a = actions.get(base);
    if (!a) return;
    a.reset().setLoop(THREE.LoopRepeat, Infinity).setEffectiveTimeScale(1);
    fadeTo(a);
  }

  mixer.addEventListener("finished", (e) => {
    if (oneShot && e.action === actions.get(oneShot)) {
      oneShot = null;
      startBase();
    }
  });

  const clock = new THREE.Clock();
  let active = false;
  let disposed = false;

  function tick() {
    const dt = Math.min(clock.getDelta(), 0.1);
    mixer.update(dt);
    if (hips && hipsHome) {
      hips.position.x = hipsHome.x;
      hips.position.z = hipsHome.z;
    }
    aim(1 - Math.exp(-dt * 2.5));
    renderer.render(scene, camera);
  }

  /** Reduced motion: one still frame, a quarter of the way into the base clip. */
  function still() {
    const a = actions.get(base);
    if (!a) return renderer.render(scene, camera);
    mixer.stopAllAction();
    current = undefined;
    a.reset().play();
    mixer.setTime(a.getClip().duration * 0.25);
    current = a;
    if (hips && hipsHome) {
      hips.position.x = hipsHome.x;
      hips.position.z = hipsHome.z;
    }
    aim(1);
    renderer.render(scene, camera);
  }

  const resize = new ResizeObserver(() => {
    frame();
    if (opts.still) still();
    else if (!active) renderer.render(scene, camera);
  });
  resize.observe(canvas);
  frame();
  if (opts.still) still();
  else startBase();

  return {
    setBase(c) {
      if (c === base) return;
      base = c;
      if (opts.still) return still();
      if (!oneShot) startBase();
    },
    play(c) {
      if (opts.still || disposed) return;
      const a = actions.get(c);
      if (!a) return;
      oneShot = c;
      a.reset().setLoop(THREE.LoopOnce, 1).setEffectiveTimeScale(ONE_SHOT_SPEED[c] ?? 1);
      a.clampWhenFinished = true;
      fadeTo(a);
    },
    setActive(on) {
      if (disposed || opts.still || on === active) return;
      active = on;
      if (on) {
        clock.getDelta();
        renderer.setAnimationLoop(tick);
      } else renderer.setAnimationLoop(null);
    },
    dispose() {
      disposed = true;
      resize.disconnect();
      renderer.setAnimationLoop(null);
      mixer.stopAllAction();
      root.traverse((o) => {
        const m = o as THREE.SkinnedMesh;
        if (m.isSkinnedMesh) (m.material as THREE.Material).dispose();
      });
      envTarget.dispose();
      renderer.dispose();
    },
  };
}
