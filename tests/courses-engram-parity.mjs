// Checks the Engram course's in-browser layer (lib/courses/tiny-engram.ts, Hyperfield CPU
// backend) against PyTorch running DeepSeek's Engram demo classes (as transcribed in
// hyperfield/scripts/engram_reference.py) on the same weights and input, one residual stream.
//   node tests/courses-engram-parity.mjs   (PYTHON / HYPERFIELD override the default paths)
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as hf from "hyperfield";
import { engramLayer, normalize } from "../lib/courses/tiny-engram.ts";

const ROOT = path.resolve(import.meta.dirname, "../..");
const PYTHON = process.env.PYTHON ?? path.join(ROOT, "yumon-pet/python-train/.venv/Scripts/python.exe");
const HYPERFIELD = process.env.HYPERFIELD ?? path.join(ROOT, "hyperfield");

await hf.init({ backend: "cpu" });
const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "engram-parity-")), "ref.json");
execFileSync(PYTHON, ["-I", path.join(HYPERFIELD, "scripts/engram_reference.py"), "--hc", "1", "--out", file], { encoding: "utf8" });
const ref = JSON.parse(fs.readFileSync(file, "utf8"));
const { batch: b, seq: s, hidden_size: d } = ref;

let worst = 0;
for (const [layer, r] of Object.entries(ref.layers)) {
  const t = (name) => hf.tensor(Float32Array.from(r.state[name].data), r.state[name].shape);
  const w = {
    maxNgram: ref.cfg.max_ngram_size,
    primes: r.primes,
    multipliers: r.multipliers.map(BigInt),
    padId: ref.cfg.pad_id,
    table: t("multi_head_embedding.embedding.weight"),
    keyW: t("key_projs.0.weight"),
    keyB: t("key_projs.0.bias"),
    valueW: t("value_proj.weight"),
    valueB: t("value_proj.bias"),
    norm1: t("norm1.0.weight"),
    norm2: t("norm2.0.weight"),
    convNorm: t("short_conv.norms.0.weight"),
    conv: t("short_conv.conv.weight"),
  };
  const x = hf.tensor(Float32Array.from(ref.hidden), [b, s, d]);
  const out = engramLayer(x, ref.ids, w);
  assert.deepEqual(Array.from(out.rows), r.hash, `layer ${layer}: hash rows match numpy`);
  const y = Array.from(await out.y.data());
  const err = Math.max(...y.map((v, i) => Math.abs(v - r.y[i])));
  assert.ok(err < 1e-5, `layer ${layer}: outputs match (max abs err ${err})`);
  worst = Math.max(worst, err);
  console.log(`layer ${layer}: primes ${JSON.stringify(r.primes)}, hash rows identical, max abs output err ${err.toExponential(2)}`);
}
for (const [a, want] of [[" Apple", "apple"], ["ÉCOLE", "ecole"], ["\n\n", " "], ["ﬁ", "fi"]]) assert.equal(normalize(a), want);
console.log(`PyTorch ${ref.torch}, numpy ${ref.numpy}: worst output err ${worst.toExponential(2)}; normalizer cases pass`);
