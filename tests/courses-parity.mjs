// Checks the course's in-browser N-Grammer (lib/courses/tiny-ngrammer.ts, Hyperfield CPU
// backend) against yumon-pet's PyTorch `Ngram` on the same weights and input.
//   node tests/courses-parity.mjs   (PYTHON / PYTHON_TRAIN override the yumon-pet venv paths)
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as hf from "hyperfield";
import { demoWeights, embedWords, ngramLayer } from "../lib/courses/tiny-ngrammer.ts";

const YUMON = path.resolve(import.meta.dirname, "../../yumon-pet/python-train");
const PYTHON = process.env.PYTHON ?? path.join(YUMON, ".venv/Scripts/python.exe");
const PYTHON_TRAIN = process.env.PYTHON_TRAIN ?? YUMON;

await hf.init({ backend: "cpu" });
const words = "the cat sat on the mat and the cat ran".split(" ");
const w = demoWeights();
const x = embedWords(words);
const t = ngramLayer(x, w);
const list = async (v) => Array.from(await v.data());

const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ngram-parity-")), "case.json");
fs.writeFileSync(file, JSON.stringify({
  width: 8, heads: w.heads, k: w.k,
  centroids: await list(w.centroids), bigrams: await list(w.bigrams), out: await list(w.out), x: await list(x),
}));
const ref = JSON.parse(execFileSync(PYTHON, ["-I", path.resolve(import.meta.dirname, "courses_parity_reference.py"), PYTHON_TRAIN, file], { encoding: "utf8" }));

const ids = await list(t.ids);
const y = await list(t.y);
assert.deepEqual(ids, ref.ids, "cluster ids match");
const err = Math.max(...y.map((v, i) => Math.abs(v - ref.y[i])));
assert.ok(err < 1e-5, `outputs match (max abs err ${err})`);
console.log(`words: ${words.join(" ")}`);
console.log(`ids (pos x head): ${JSON.stringify(ids)}`);
console.log(`rows: ${JSON.stringify(await list(t.rows))}`);
console.log(`PyTorch ${ref.torch}: ids identical, max abs output err ${err.toExponential(2)}`);
