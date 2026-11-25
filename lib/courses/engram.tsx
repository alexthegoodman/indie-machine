import type { Course } from "./types";
import { Bullets, Formula, Lead, Note, P, Table } from "@/components/courses/Prose";
import { CodeBlock, CodeCompare, courseSnippet } from "@/components/courses/Code";
import { MermaidBlock } from "@/components/MermaidBlock";
import { CompressionViz } from "@/components/courses/viz/CompressionViz";
import { HashBuckets } from "@/components/courses/viz/HashBuckets";
import { GateCurve } from "@/components/courses/viz/GateCurve";
import { ConvTaps } from "@/components/courses/viz/ConvTaps";
import { LiveEngram } from "@/components/courses/viz/LiveEngram";

const PAPER = "https://arxiv.org/abs/2601.07372";
const REPO = "https://github.com/deepseek-ai/Engram";
const HYPERFIELD = "https://github.com/alexthegoodman/hyperfield";

// deepseek-ai/Engram engram_demo_v1.py, NgramHashMapping._get_ngram_hashes (verbatim).
const TORCH_HASH = `
def _get_ngram_hashes(self, input_ids: np.ndarray, layer_id: int) -> np.ndarray:
    x = np.asarray(input_ids, dtype=np.int64)
    B, T = x.shape
    multipliers = self.layer_multipliers[layer_id]

    def shift_k(k: int) -> np.ndarray:
        if k == 0: return x
        shifted = np.pad(x, ((0, 0), (k, 0)),
                            mode='constant', constant_values=self.pad_id)[:, :T]
        return shifted

    base_shifts = [shift_k(k) for k in range(self.max_ngram_size)]
    all_hashes = []
    for n in range(2, self.max_ngram_size + 1):
        n_gram_index = n - 2
        tokens = base_shifts[:n]
        mix = (tokens[0] * multipliers[0])
        for k in range(1, n):
            mix = np.bitwise_xor(mix, tokens[k] * multipliers[k])
        num_heads_for_this_ngram = self.n_head_per_ngram
        head_vocab_sizes = self.vocab_size_across_layers[layer_id][n_gram_index]
        for j in range(num_heads_for_this_ngram):
            mod = int(head_vocab_sizes[j])
            head_hash = mix % mod
            all_hashes.append(head_hash.astype(np.int64, copy=False))
    return np.stack(all_hashes, axis=2)`;

// deepseek-ai/Engram engram_demo_v1.py, Engram.forward (verbatim).
const TORCH_FORWARD = `
def forward(self,hidden_states,input_ids):
    """
    hidden_states: [B, L, HC_MULT, D]
    input_ids: [B, L]
    """
    hash_input_ids = torch.from_numpy(self.hash_mapping.hash(input_ids)[self.layer_id])
    embeddings = self.multi_head_embedding(hash_input_ids).flatten(start_dim=-2)
    gates = []
    for hc_idx in range(backbone_config.hc_mult):
        key = self.key_projs[hc_idx](embeddings)
        normed_key = self.norm1[hc_idx](key)
        query = hidden_states[:,:,hc_idx,:]
        normed_query = self.norm2[hc_idx](query)
        gate = (normed_key * normed_query).sum(dim=-1) / math.sqrt(backbone_config.hidden_size)
        gate = gate.abs().clamp_min(1e-6).sqrt() * gate.sign()
        gate = gate.sigmoid().unsqueeze(-1)
        gates.append(gate)
    gates = torch.stack(gates,dim=2)
    value = gates * self.value_proj(embeddings).unsqueeze(2)
    output = value + self.short_conv(value)
    return output`;

const HF_MODULE = `
import * as hf from "hyperfield"; // 0.2.0

const { lookup, size } = hf.text.compressVocab(tokenizer);
const engram = new hf.nn.Engram({
  layerId: 1, layerIds: [1, 15], hiddenSize: 1024, hcMult: 4,
  maxNgram: 3, headsPerNgram: 8, embedPerNgram: 512,
  tableSizes: [size * 5, size * 5], vocabSize: size, lookup,
});
engram.loadStateDict(stateDict); // the demo's parameter names
h = engram.call({ hidden: h, ids }).add(h); // ids: raw token ids, on the host`;

const PIPELINE = `flowchart LR
  T["token ids [b, s]"] --> C["compress<br/>NFKC, lowercase..."]
  C --> H["hash each 2- and 3-gram<br/>K heads, prime tables"]
  H --> E["look up rows<br/>concat: memory e"]
  X["hidden h [b, s, d]"] --> G
  E --> G["gate = σ(signed √(norm(W_K e) · norm(h) / √d))"]
  E --> V["W_V e"]
  G --> M(("×"))
  V --> M
  M --> S["+ SiLU(short conv)"]
  S --> A(("+"))
  X --> A
  A --> Y["h + Engram(h)"]`;

const PREFETCH = `sequenceDiagram
  participant CPU as Host (DRAM table)
  participant GPU as GPU
  Note over CPU,GPU: token ids are known before the forward pass
  CPU->>CPU: hash n-grams, gather rows
  CPU-->>GPU: copy rows over PCIe
  GPU->>GPU: block 1 (overlaps the copy)
  GPU->>GPU: block 2: Engram uses the rows
  GPU->>GPU: blocks 3..N`;

export const engramCourse: Course = {
  slug: "engram",
  title: "The Engram Course",
  tagline: "DeepSeek's conditional memory for transformers, from hash to gate.",
  description:
    "A free, interactive course on DeepSeek's Engram: tokenizer compression, multi-head n-gram hashing, the context-aware gate and short conv, a working layer in PyTorch and Hyperfield (TypeScript) side by side, and how the tables are trained and served from host memory.",
  intro: (
    <>
      Engram (DeepSeek and Peking University, 2026) gives a transformer a huge table of n-gram memories that it reads with a hash instead of computing. This
      course takes the layer apart in six short lessons - why a lookup at all, how tokens are compressed, how n-grams are hashed into tables, how the
      hidden state gates what comes back, the code in PyTorch and Hyperfield side by side, and how the paper trains and serves it - with interactive
      diagrams, quizzes, and a real layer that runs in your browser and matches DeepSeek&apos;s demo code.
    </>
  ),
  level: "Intermediate",
  prerequisites: [
    "Basic Python or TypeScript",
    "What a tensor shape like [batch, seq, width] means",
    "A rough idea of attention, residual streams and Mixture-of-Experts",
  ],
  teaches: [
    "Why DeepSeek pairs conditional computation (MoE) with conditional memory (Engram), and what the paper measured",
    "Tokenizer compression: merging vocabulary entries that normalize to the same text",
    "Multi-head n-gram hashing with multiplicative-XOR hashes and prime-sized tables",
    "The context-aware gate, its signed square root, and the dilated short convolution",
    "Translating the official Engram demo from PyTorch to Hyperfield, op by op",
    "Placement, the sparsity split, host-memory offloading and the training recipe",
  ],
  updated: "2026-11-24",
  lessons: [
    {
      slug: "memory-vs-compute",
      title: "Memory instead of compute",
      kind: "concept",
      minutes: 6,
      summary: "What Engram is, why a lookup table belongs next to Mixture-of-Experts, and what DeepSeek measured with it.",
      takeaways: [
        "MoE is conditional computation; Engram is conditional memory - a lookup keyed by the last few tokens.",
        "The lookup is O(1) and deterministic: it depends only on the token ids, not on the hidden state.",
        "At equal total and active parameters, Engram-27B beat a MoE-27B baseline across knowledge, reasoning, code and math.",
      ],
      slides: [
        {
          id: "static",
          title: "Some knowledge is a lookup",
          body: (
            <>
              <Lead>“Alexander the” is followed by “Great”. A transformer spends layers working that out every time it reads the phrase.</Lead>
              <P>
                Language has a lot of this: names, idioms, code boilerplate, phrases that always mean the same thing. None of it depends on the rest of the
                document. It is static: the last two or three tokens are enough to know it.
              </P>
              <P>
                A transformer has no native way to <em>look something up</em>. It has to rebuild these patterns with attention and MLPs, in its early layers,
                on every token. Engram&apos;s premise is that this is wasted depth: give the model a table it can read for the static part, and the layers can
                work on what actually needs computing.
              </P>
            </>
          ),
        },
        {
          id: "two-axes",
          title: "Two kinds of sparsity",
          body: (
            <>
              <P>
                The <a href={PAPER}>Engram paper</a> (Cheng, Tian et al., arXiv 2601.07372, January 2026) frames it as a second axis of sparsity next to
                Mixture-of-Experts:
              </P>
              <Table
                head={["", "Mixture-of-Experts", "Engram"]}
                rows={[
                  ["What is sparse", "Computation: a router picks a few expert MLPs per token", "Memory: a hash picks a few table rows per token"],
                  ["Chosen by", "The hidden state (learned routing)", "The token ids alone (deterministic)"],
                  ["Cost per token", "A few expert MLPs", "A few row reads, then two projections"],
                  ["Good at", "Anything that needs computing", "Static, local patterns"],
                ]}
              />
              <P>
                Because Engram&apos;s addresses depend only on the input tokens, they are known before the forward pass starts. That detail ends up mattering
                a lot for serving (lesson 6).
              </P>
            </>
          ),
        },
        {
          id: "q-axis",
          title: "Quick check",
          quiz: {
            question: "What decides which Engram rows a token reads?",
            options: ["A learned router over the hidden state", "The token and the few tokens before it, hashed", "Attention scores", "A random sample per step"],
            answer: 1,
            explain:
              "Engram hashes the n-grams that end at the token (2- and 3-grams in the paper). The hidden state only decides how much of what comes back to use - that is the gate, lesson 4.",
          },
        },
        {
          id: "results",
          title: "What the paper measured",
          body: (
            <>
              <P>
                DeepSeek trained models with the same total parameters (26.7B) and the same activated parameters (3.8B) on the same 262B tokens. Engram-27B
                moves 5.7B parameters from routed experts (72 down to 55) into two Engram layers. From the paper&apos;s Table 1:
              </P>
              <Table
                head={["Benchmark", "MoE-27B", "Engram-27B", "Engram-40B"]}
                rows={[
                  ["MMLU", "57.4", "60.4", "60.6"],
                  ["CMMLU", "57.9", "61.9", "63.4"],
                  ["BBH", "50.9", "55.9", "57.5"],
                  ["ARC-Challenge", "70.1", "73.8", "76.4"],
                  ["HumanEval", "37.8", "40.8", "38.4"],
                  ["GSM8K", "58.4", "60.6", "62.6"],
                  ["MATH", "28.3", "30.7", "30.6"],
                  ["Validation loss", "1.768", "1.634", "1.610"],
                ]}
              />
              <Note title="READING THE NUMBERS">
                These are DeepSeek&apos;s numbers, not ours. The abstract quotes MMLU as +3.4; the table gives 57.4 to 60.4, which is +3.0. Engram-40B (18.5B
                Engram parameters) does not beat Engram-27B everywhere; the paper calls that likely under-training. Reasoning and code gained as much as
                knowledge, which is the paper&apos;s argument that the memory frees up depth rather than just storing facts.
              </Note>
            </>
          ),
        },
        {
          id: "q-iso",
          title: "Quick check",
          quiz: {
            question: "Engram-27B and MoE-27B were compared at equal…",
            options: [
              "Total parameters only",
              "Total parameters, activated parameters and training tokens",
              "Training time",
              "Number of experts",
            ],
            answer: 1,
            explain:
              "Both have 26.7B total and 3.8B activated parameters and saw 262B tokens. Engram-27B pays for its tables with fewer routed experts (55 instead of 72).",
          },
        },
        {
          id: "vs-ngrammer",
          title: "If you took the N-Grammer course",
          body: (
            <>
              <P>
                <a href="/courses/n-grammer">N-Grammer</a> is the closest relative. Both add an n-gram table to the residual stream, but they key it
                differently:
              </P>
              <Table
                head={["", "N-Grammer (Yumon)", "Engram"]}
                rows={[
                  ["Keys", "Latent cluster ids of the hidden state", "Surface token ids, normalized"],
                  ["Orders", "Bigrams", "2- and 3-grams"],
                  ["Table", "Exact: one row per id pair", "Hashed into prime-sized tables, several heads"],
                  ["Uses the hidden state for", "Computing the ids", "Gating what comes back"],
                  ["Added to x", "Linear projection, zero init", "Gated value + short conv"],
                ]}
              />
            </>
          ),
        },
      ],
    },
    {
      slug: "tokenizer-compression",
      title: "Tokenizer compression",
      kind: "concept",
      minutes: 5,
      summary: "Why Engram merges vocabulary entries that normalize to the same text before hashing, and how much that shrinks real vocabularies.",
      takeaways: [
        "Each token is decoded and normalized (NFKC, NFD, strip accents, lowercase, collapse whitespace); equal results share one id.",
        "DeepSeek-V3's 128,815-entry vocabulary compresses to 98,627 ids (23.44% fewer); the paper reports 23.43%.",
        "Compression is a lookup from raw id to compressed id, applied before hashing. The model's own tokenizer is unchanged.",
      ],
      slides: [
        {
          id: "why",
          title: "“Apple”, “ apple”, “APPLE”",
          body: (
            <>
              <P>
                BPE vocabularies are full of near-duplicates: the same word with and without a leading space, capitalized, all caps, with an accent. To the
                model they are different ids, so an n-gram table keyed on raw ids would learn “the Apple” and “the apple” separately - and see each one
                less often.
              </P>
              <P>
                Engram collapses them first. The paper describes a surjective map from the vocabulary V to a smaller V′, “based on normalized textual
                equivalence”. The demo code does it with Hugging Face normalizers, verbatim:
              </P>
              <Formula note="A lone space survives as a token: it is swapped for a sentinel before Strip and back after.">NFKC → NFD → StripAccents → Lowercase → [ \t\r\n]+ → “ ” → Strip</Formula>
              <CompressionViz />
            </>
          ),
        },
        {
          id: "q-merge",
          title: "Quick check",
          quiz: {
            question: "Which of these end up as the same compressed id?",
            options: ["“Apple” and “Apples”", "“ Pear” and “PEAR”", "“pear” and “bear”", "“1” and “one”"],
            answer: 1,
            explain:
              "Normalization strips the leading space and lowercases, so “ Pear” and “PEAR” both become “pear”. It never changes letters or stems words, so “Apples” stays separate.",
          },
        },
        {
          id: "measured",
          title: "How much does it compress?",
          body: (
            <>
              <P>
                We ran the demo&apos;s normalizer over two real vocabularies, once in Python with the <code>tokenizers</code> library and once with
                Hyperfield&apos;s <code>hf.text.compressVocab</code>. Both gave the same lookup table, id for id:
              </P>
              <Table
                head={["Tokenizer", "Entries", "Compressed ids", "Reduction"]}
                rows={[
                  ["DeepSeek-V3 (tokenizer.json, incl. added tokens)", "128,815", "98,627", "23.44%"],
                  ["Yumon (8k BPE, already lowercased)", "8,192", "7,268", "11.28%"],
                ]}
              />
              <P>
                The paper reports 23.43% for its 128k tokenizer, and the biggest groups match it: the space (163 vocabulary entries become “ ”), then “a”
                (54), “o” (40), “e” (35) and “i” (30). Yumon&apos;s tokenizer already lowercases its input and still loses 11%, mostly to leading-space
                variants such as “cat” and “ cat”.
              </P>
              <Note title="PORTING THE NORMALIZER TO JAVASCRIPT">
                Three places where the obvious JavaScript differs from Hugging Face <code>tokenizers</code>, each of which changes DeepSeek-V3&apos;s count:{" "}
                <code>StripAccents</code> removes every combining mark (<code>\p&#123;M&#125;</code>, which includes the spacing vowel signs of Bengali and
                Devanagari), not only <code>\p&#123;Mn&#125;</code>; <code>String.prototype.trim()</code> strips U+FEFF, which Rust&apos;s{" "}
                <code>char::is_whitespace</code> does not; and <code>TextDecoder</code> drops a leading U+FEFF unless you pass{" "}
                <code>ignoreBOM: true</code>, so the tokens that decode to it come out empty.
              </Note>
            </>
          ),
        },
        {
          id: "q-where",
          title: "Quick check",
          quiz: {
            question: "Where does the compressed id get used?",
            options: [
              "Everywhere - the model is retrained on the compressed tokenizer",
              "Only as the input to Engram's n-gram hash",
              "Only in the output softmax",
              "In attention",
            ],
            answer: 1,
            explain:
              "The backbone keeps its full vocabulary. Compression is a raw id → compressed id table applied inside Engram, so “the Apple” and “the apple” hash to the same rows.",
          },
        },
      ],
    },
    {
      slug: "multi-head-hashing",
      title: "Hashing n-grams into tables",
      kind: "math",
      minutes: 7,
      summary: "The multiplicative-XOR hash, why each head's table has a prime size, why several heads, and how big the tables get.",
      takeaways: [
        "For order n: mix = t₀·m₀ ⊕ t₋₁·m₁ ⊕ … ⊕ t₋₍ₙ₋₁₎·mₙ₋₁ with odd per-layer multipliers; head j reads row mix mod pⱼ.",
        "Every head has its own prime pⱼ, distinct across all heads and layers, so the heads collide on different n-grams.",
        "The demo config has about 10.3M rows per layer: 662M parameters at 64 numbers per row.",
      ],
      slides: [
        {
          id: "too-many",
          title: "Too many n-grams for an exact table",
          body: (
            <>
              <P>
                N-Grammer could afford an exact table because it paired a few hundred cluster ids. Engram keys on real tokens. With about 98,600 compressed
                ids:
              </P>
              <Formula note="Almost all of them never occur. An exact table would be mostly empty rows.">98,627² ≈ 9.7 billion bigrams,   98,627³ ≈ 9.6 × 10¹⁴ trigrams</Formula>
              <P>
                So Engram hashes. Every n-gram gets squeezed into a fixed table of M rows. Two different n-grams can land on the same row - a{" "}
                <strong>collision</strong> - and the design is about making collisions rare and survivable.
              </P>
            </>
          ),
        },
        {
          id: "mix",
          title: "The hash",
          body: (
            <>
              <P>Each layer draws one odd 64-bit multiplier per position in the window. For the n-gram ending at token t:</P>
              <Formula note="⊕ is bitwise XOR. In the demo the products stay inside int64: multipliers are below (2⁶³ − 1) / vocab.">
                mix = t₀·m₀ ⊕ t₋₁·m₁ ⊕ … ⊕ t₋₍ₙ₋₁₎·mₙ₋₁
              </Formula>
              <Formula note="Before the first token, the missing history is the pad id.">row = mix mod pⱼ   for head j</Formula>
              <P>
                The bigram and trigram at a position share the first two terms of the XOR: the trigram is the bigram&apos;s mix XOR one more product, which is
                why the code builds them in one loop.
              </P>
            </>
          ),
        },
        {
          id: "buckets",
          title: "Watch it collide",
          body: (
            <>
              <P>Real tables have about 646,000 rows per head. These have 31 to 43, so collisions show up in a single sentence.</P>
              <HashBuckets />
            </>
          ),
        },
        {
          id: "heads",
          title: "Why several heads, why primes",
          body: (
            <>
              <P>
                Each order has K heads (8 in the paper and the demo), and each head has its own table with a <strong>different prime</strong> number of rows.
                The demo picks them by walking up from the target size and skipping any prime already taken, across both orders and every Engram layer.
              </P>
              <P>
                A row of one head can be shared by several n-grams, but the memory vector concatenates all heads, so two n-grams only read identical memory
                if they collide in every head at once. If the heads behaved like independent uniform hashes, two given n-grams would share all K rows with
                probability 1 / (p₁·p₂·…·p_K). Different moduli are what keep the heads from colliding on the same pairs: with equal table sizes, two mixes
                that differ by a multiple of p would collide in every head together.
              </P>
              <Formula note="Head 3's rows start where head 2's end. Offsets are a fixed buffer, so the layer is one embedding gather.">
                global row = row + p₀ + p₁ + … + pⱼ₋₁
              </Formula>
            </>
          ),
        },
        {
          id: "q-row",
          title: "Quick check",
          quiz: {
            question: "Bigram ids (3, 5), multipliers m₀ = 2, m₁ = 7, head prime 11. Which row? (current token 5, previous 3)",
            options: ["row 0", "row 9", "row 2", "row 10"],
            answer: 1,
            explain: "mix = 5·2 ⊕ 3·7 = 10 ⊕ 21. In binary 01010 ⊕ 10101 = 11111 = 31, and 31 mod 11 = 9.",
          },
        },
        {
          id: "size",
          title: "How big are the tables?",
          body: (
            <>
              <P>
                The demo config: 2 orders × 8 heads, each table a prime just above 5 × 129,280 = 646,400 rows, each row 512 / 8 = 64 numbers. Hyperfield&apos;s
                prime search gives the same sizes as the demo&apos;s:
              </P>
              <Table
                head={["Demo layer", "Smallest / largest prime", "Rows", "Parameters (×64)"]}
                rows={[
                  ["1", "646,403 / 646,619", "10,344,164", "662,026,496"],
                  ["15", "646,631 / 646,879", "10,348,242", "662,287,488"],
                ]}
              />
              <P>
                Each token reads 16 rows of 64 numbers per layer - 1,024 values out of 662 million. That ratio is the whole pitch: parameters that cost
                memory, but almost no compute.
              </P>
            </>
          ),
        },
        {
          id: "q-collide",
          title: "Quick check",
          quiz: {
            question: "Two different trigrams collide in head 0 but not in head 1. What does the layer read for them?",
            options: [
              "The same memory vector",
              "Memory vectors that share head 0's slice and differ in head 1's",
              "Nothing - collisions are skipped",
              "An error",
            ],
            answer: 1,
            explain:
              "The memory is the concatenation of every head's row. A collision in one head makes one slice shared; the other heads still tell them apart, and the gate can down-weight a bad read.",
          },
        },
      ],
    },
    {
      slug: "gate-and-conv",
      title: "The gate and the short conv",
      kind: "math",
      minutes: 7,
      summary: "How the hidden state decides how much memory to let in, why the demo takes a signed square root, and what the dilated causal conv adds.",
      takeaways: [
        "gate = σ(signed √(⟨norm(W_K e), norm(h)⟩ / √d)), one scalar per position (and per stream with hyper-connections).",
        "After RMSNorm the dot product over √d equals cos·√d, so without the square root the sigmoid is nearly a switch at large d.",
        "The conv has kernel 4 and dilation 3: each output mixes the gated values of positions t, t−3, t−6, t−9.",
      ],
      slides: [
        {
          id: "why-gate",
          title: "The lookup can't see context",
          body: (
            <>
              <P>
                The rows come from the last few tokens only. A hash collision brings back another n-gram&apos;s memory, and even a correct read can be wrong
                for this document - “bank” after “river” versus after “central”. The hidden state at this position knows much more, so Engram lets it decide.
              </P>
              <MermaidBlock chart={PIPELINE} />
            </>
          ),
        },
        {
          id: "formula",
          title: "The gate",
          body: (
            <>
              <P>The memory e (all rows, concatenated) is projected to a key and compared with the hidden state h, which plays the query:</P>
              <Formula note="Both sides are RMS-normalized, each with its own learned scale. d is the hidden width.">z = ⟨RMSNorm(W_K e), RMSNorm(h)⟩ / √d</Formula>
              <Formula note="The paper's equation applies σ to z directly; the released demo code takes the signed square root first.">
                gate = σ( sign(z) · √max(|z|, 10⁻⁶) )
              </Formula>
              <P>
                Then <code>value = gate · W_V e</code>. With hyper-connections (the paper uses 4 streams) each stream has its own key projection and norms,
                so its own gate; the value projection is shared.
              </P>
            </>
          ),
        },
        {
          id: "curve",
          title: "Why the square root",
          body: (
            <>
              <P>
                RMSNorm makes both vectors length √d, so z = cos · √d. At d = 1,024 that is 32 · cos: a cosine of 0.2 already gives σ(6.4) = 0.998. The
                signed square root brings the same input to σ(2.53) = 0.926, so the gate stays graded across a wider range of agreement. Drag the width up and
                compare the curves:
              </P>
              <GateCurve />
              <Note>
                This is our reading of the arithmetic, not a claim from the paper - the paper&apos;s gate equation has no square root at all, and the demo
                does not explain it.
              </Note>
            </>
          ),
        },
        {
          id: "q-gate",
          title: "Quick check",
          quiz: {
            question: "What shape is the gate for hidden states [b, s, d] with one stream?",
            options: ["[b, s, d]", "[b, s] - one scalar per position", "[d]", "[b, s, heads]"],
            answer: 1,
            explain: "The dot product sums over d, so each position gets one number in (0, 1) that scales the whole value vector.",
          },
        },
        {
          id: "conv",
          title: "A short conv over the gated values",
          body: (
            <>
              <P>The last step runs a depthwise causal convolution over RMSNorm(value), then adds it back:</P>
              <Formula note="Kernel 4, dilation = the largest n-gram order (3). Depthwise: each channel has its own 4 weights.">out = value + SiLU( conv( RMSNorm(value) ) )</Formula>
              <ConvTaps />
              <P>
                With dilation 3, the conv lines up with trigram boundaries: it mixes the memories of the previous non-overlapping trigrams into this one. The
                paper&apos;s ablation found that removing it “only marginally degrades performance” - it is the least important of the parts.
              </P>
            </>
          ),
        },
        {
          id: "q-taps",
          title: "Quick check",
          quiz: {
            question: "Kernel 4, dilation 3, output position t = 10. Which positions does it read?",
            options: ["7, 8, 9, 10", "1, 4, 7, 10", "10, 13, 16, 19", "0, 3, 6, 9"],
            answer: 1,
            explain: "Tap j reads t − (3 − j)·3: 10 − 9, 10 − 6, 10 − 3, 10. It is causal, so it never reads ahead.",
          },
        },
      ],
    },
    {
      slug: "pytorch-to-hyperfield",
      title: "Coding it: PyTorch to Hyperfield",
      kind: "code",
      minutes: 8,
      summary: "DeepSeek's demo Engram next to a Hyperfield (TypeScript) version, op by op, with a live layer that matches PyTorch.",
      takeaways: [
        "The hash is host-side integer work: int64 in numpy, BigInt in TypeScript.",
        "The layer itself is a gather, two linears, two RMSNorms, a sigmoid and a conv built from shifted gathers.",
        "The course layer gives identical hash rows and outputs within 4.8e-7 of PyTorch 2.14.1.",
        "Hyperfield 0.2.0 packages it as hf.nn.Engram with the demo's parameter names.",
      ],
      slides: [
        {
          id: "hash-code",
          title: "The hash in both",
          body: (
            <>
              <P>
                On the left, the hash from DeepSeek&apos;s <a href={REPO}>engram_demo_v1.py</a>. On the right, the one this course runs. numpy&apos;s int64
                products fit exactly in a JavaScript BigInt; a plain <code>number</code> would lose bits above 2⁵³.
              </P>
              <CodeCompare>
                <CodeBlock lang="python" label="PYTORCH / NUMPY" source="engram_demo_v1.py" code={TORCH_HASH} />
                <CodeBlock lang="ts" label="HYPERFIELD" source="lib/courses/engram-hash.ts" code={courseSnippet("engram-hash.ts", "export function engramHash")} />
              </CodeCompare>
            </>
          ),
        },
        {
          id: "forward",
          title: "The layer in both",
          body: (
            <>
              <P>
                The demo runs four hyper-connection streams; the course layer has one, which turns the per-stream loops into single expressions. The numbered
                comments follow the demo&apos;s order.
              </P>
              <CodeCompare>
                <CodeBlock lang="python" label="PYTORCH" source="Engram.forward" code={TORCH_FORWARD} />
                <CodeBlock lang="ts" label="HYPERFIELD" source="lib/courses/tiny-engram.ts" code={courseSnippet("tiny-engram.ts", "export function engramLayer")} />
              </CodeCompare>
            </>
          ),
        },
        {
          id: "mapping",
          title: "Op by op",
          body: (
            <Table
              head={["Step", "PyTorch", "Hyperfield", "Note"]}
              rows={[
                ["Hash", <code key="a">np.bitwise_xor(mix, t * m)</code>, <code key="b">mix ^= tok * m</code>, "BigInt keeps int64 exact"],
                ["Head offsets", <code key="a">input_ids + self.offsets</code>, <code key="b">r + offsets[i % heads]</code>, "Done on the host here"],
                ["Lookup", <code key="a">self.embedding(ids)</code>, <code key="b">table.indexSelect(0, rows)</code>, "nn.Embedding is a row gather"],
                ["Concat heads", <code key="a">.flatten(start_dim=-2)</code>, <code key="b">.reshape([b, s, -1])</code>, ""],
                ["Signed sqrt", <code key="a">g.abs().clamp_min(1e-6).sqrt() * g.sign()</code>, <code key="b">g.abs().maximum(1e-6).sqrt().mul(g.sign())</code>, "clamp_min = maximum with a number"],
                ["Causal conv", <code key="a">nn.Conv1d(..., groups=C, padding=(k-1)*d)[..., :T]</code>, <code key="b">cat(zeros, x) + k shifted indexSelects</code>, "One gather per tap"],
                ["SiLU", <code key="a">nn.SiLU()</code>, <code key="b">x.mul(x.sigmoid())</code>, ""],
              ]}
            />
          ),
        },
        {
          id: "q-bigint",
          title: "Quick check",
          quiz: {
            question: "Why does the TypeScript hash use BigInt?",
            options: [
              "BigInt is faster than number",
              "The demo's products are int64 values far above 2⁵³, where a double loses exactness",
              "XOR does not work on numbers",
              "WebGPU requires it",
            ],
            answer: 1,
            explain:
              "Multipliers go up to (2⁶³ − 1) / vocab, so products are up to 63 bits. JavaScript numbers are doubles (53-bit integers) and bitwise ops on them are 32-bit, so the hash would silently differ.",
          },
        },
        {
          id: "live",
          title: "Run it in your browser",
          body: (
            <>
              <P>
                This table is computed by <code>engramLayer</code> from the previous step, live, with Hyperfield in this page. “The cat sat on the” appears
                twice with different capitals: after compression it reads the same rows both times.
              </P>
              <LiveEngram />
            </>
          ),
        },
        {
          id: "parity",
          title: "Does it match PyTorch?",
          body: (
            <>
              <P>
                The parity test builds DeepSeek&apos;s demo classes in PyTorch (shrunk to width 8 and tables of 37-67 rows, random weights), runs them, and
                loads the same weights into <code>engramLayer</code>:
              </P>
              <Formula>node tests/courses-engram-parity.mjs</Formula>
              <Table
                head={["Check", "Result"]}
                rows={[
                  ["Hash rows, 2 layers × 2 × 12 tokens × 4 heads", "Identical to numpy"],
                  ["Max absolute output error", "4.8e-7"],
                  ["Reference", "PyTorch 2.14.1+cpu, numpy 2.5.4, fp32"],
                  ["Hyperfield", "0.1.0, CPU backend, Node 24.11"],
                ]}
              />
              <P>
                Hyperfield 0.2.0&apos;s <code>hf.nn.Engram</code> is checked the same way with two hyper-connection streams, including every gradient
                (max error 2.6e-6).
              </P>
            </>
          ),
        },
        {
          id: "packaged",
          title: "The packaged layer",
          body: (
            <>
              <P>
                <a href={HYPERFIELD}>Hyperfield</a> 0.2.0 ships the full layer: streams, tokenizer compression, KV-cache state for generation, and the
                demo&apos;s parameter names, so a state dict saved from the demo loads without renaming.
              </P>
              <CodeBlock lang="ts" label="HYPERFIELD 0.2.0" source="hf.nn.Engram" code={HF_MODULE} />
              <Note>
                The demo draws its multipliers with numpy&apos;s random generator, which Hyperfield does not reimplement. Loading a trained model means passing
                its multipliers in (<code>multipliers</code>), the way the parity test does.
              </Note>
            </>
          ),
        },
        {
          id: "q-host",
          title: "Quick check",
          quiz: {
            question: "Where does the hash run in Hyperfield's layer?",
            options: ["In a WebGPU kernel", "On the host, before any GPU work", "Inside the embedding gather", "It is precomputed for every possible n-gram"],
            answer: 1,
            explain:
              "The ids are integers known up front, so hashing them is host work (about 1 ms for 8 × 256 tokens on an i5-12500). Only the row indices go to the GPU.",
          },
        },
      ],
    },
    {
      slug: "training-and-serving",
      title: "Training and serving Engram",
      kind: "concept",
      minutes: 7,
      summary: "Where the layers go, how much of the parameter budget to give them, the training recipe, serving a 100B table from host memory, and what Engram ends up storing.",
      takeaways: [
        "The paper puts Engram at layers 2 and 15 of 30; a single early layer works best.",
        "About 20-25% of the sparse parameter budget in Engram (the rest in experts) gave the lowest loss.",
        "Tables train with Adam at 5× the base learning rate and no weight decay; the conv starts at zero.",
        "A 100B-parameter table in host DRAM cost at most 2.8% throughput, because the rows can be fetched before they are needed.",
      ],
      slides: [
        {
          id: "placement",
          title: "Where it goes",
          body: (
            <>
              <P>
                Engram-27B has two Engram layers in a 30-block model, at layers 2 and 15 (the demo&apos;s config writes them 0-indexed as <code>[1, 15]</code>
                ). The output is added to the residual before attention and the MoE of that block.
              </P>
              <P>
                In the paper&apos;s ablation on a 12-layer model, a single Engram layer did best at layer 2 and got worse the deeper it went. Early placement is
                consistent with the paper&apos;s analysis: models with Engram reach a given internal representation earlier, as if they had more effective
                depth (their CKA study matches Engram-27B&apos;s layer 5 to the MoE baseline&apos;s layer 12).
              </P>
            </>
          ),
        },
        {
          id: "split",
          title: "How much memory?",
          body: (
            <>
              <P>
                Hold total and active parameters fixed and move a share of the sparse (inactive) budget from experts to Engram. The paper calls the expert
                share ρ:
              </P>
              <Formula note="ρ = 100% is pure MoE.">P_MoE = ρ · P_sparse,   P_Engram = (1 − ρ) · P_sparse</Formula>
              <Table
                head={["Finding", "Paper"]}
                rows={[
                  ["Best split", "ρ ≈ 75-80%: 20-25% of the sparse budget in Engram"],
                  ["Loss at 10B total, pure MoE → best split", "1.7248 → 1.7109"],
                  ["Still matches pure MoE at", "ρ ≈ 40%"],
                  ["Engram-27B", "ρ = 74.3%"],
                ]}
              />
              <P>
                Both extremes lose: all experts means no memory, all memory means too little computation. Plotted against ρ, validation loss traces
                the U-shaped scaling law in the paper.
              </P>
            </>
          ),
        },
        {
          id: "q-split",
          title: "Quick check",
          quiz: {
            question: "With ρ = 80%, what share of the sparse parameters is Engram?",
            options: ["80%", "20%", "8%", "It depends on the batch size"],
            answer: 1,
            explain: "ρ is the experts' share, so Engram gets 1 − ρ = 20%. That is inside the 20-25% range the paper found best.",
          },
        },
        {
          id: "recipe",
          title: "The training recipe",
          body: (
            <>
              <Bullets
                items={[
                  <>The embedding tables train with Adam at <strong>5×</strong> the base learning rate and <strong>no weight decay</strong>; the backbone uses Muon at 4e-4 with weight decay 0.1.</>,
                  <>The conv weights start at <strong>zero</strong>, “to strictly preserve the identity mapping” of the conv branch.</>,
                  <>Each row only gets gradient when an n-gram hashes to it, so updates are sparse: a scatter-add in the backward pass, not a dense matmul.</>,
                ]}
              />
              <P>Set the conv scale to 0 and the conv branch adds nothing: the output is exactly the gated value. Raise it and |y − value| appears.</P>
              <LiveEngram showConv initial="The cat sat on the mat" />
              <Note title="IN HYPERFIELD">
                Hyperfield 0.1.0 computed an embedding&apos;s gradient as a one-hot matrix product. For 2,048 lookups into a 40,960-row table that took
                439-481 ms on an Intel UHD 770 (WebGPU, Chrome 157); 0.2.0&apos;s scatter-add kernel takes 4.0-4.9 ms. A full training step of a
                10.6M-parameter Engram layer on 8 × 256 tokens takes 120-124 ms on the same GPU.
              </Note>
            </>
          ),
        },
        {
          id: "serving",
          title: "Serving a 100B table",
          body: (
            <>
              <P>
                Because rows depend only on token ids, the server knows which rows a step needs before the first block runs. The paper keeps the whole table
                in host memory and copies just those rows over PCIe while the first block computes:
              </P>
              <MermaidBlock chart={PREFETCH} />
              <Table
                head={["Backbone (H800, nano-vLLM)", "Without Engram", "With a 100B-param Engram table in DRAM"]}
                rows={[
                  ["4B dense", "9,031.62 tok/s", "8,858.28 tok/s"],
                  ["8B dense", "6,315.52 tok/s", "6,140.02 tok/s (−2.8%)"],
                ]}
              />
              <P>
                No caching in GPU memory was used for those runs, so every row crossed PCIe. MoE cannot do this: its routing depends on the hidden state, so
                it is only known once the previous layer has finished.
              </P>
            </>
          ),
        },
        {
          id: "q-prefetch",
          title: "Quick check",
          quiz: {
            question: "Why can Engram's rows be prefetched from host memory when MoE experts can't?",
            options: [
              "Engram tables are smaller",
              "The rows depend only on the input token ids, so they are known before the forward pass",
              "MoE experts are always on the GPU",
              "Engram skips the GPU entirely",
            ],
            answer: 1,
            explain: "Deterministic addressing: hash the tokens, and you know every row any Engram layer will read for this step. An MoE router needs the hidden state first.",
          },
        },
        {
          id: "what-it-stores",
          title: "What ends up in the table",
          body: (
            <>
              <P>
                The paper switches Engram off at inference in a trained model. Factual-knowledge benchmarks keep only 29-44% of their score (TriviaQA 29%);
                reading comprehension keeps 81-93% (C3 93%). The table holds the facts; the context-dependent work stays in the backbone - the split the
                design was aiming for.
              </P>
              <P>
                For generation, a cached decode step only needs each Engram layer&apos;s last two token ids (for the next trigram) and the last nine conv
                inputs. Hyperfield&apos;s layer keeps both in the KV cache, and chunked decoding gives the same outputs as one full pass.
              </P>
              <Bullets
                items={[
                  "Compress the vocabulary, hash every 2- and 3-gram into several prime-sized tables.",
                  "Concatenate the rows; let the hidden state gate them through a signed-sqrt sigmoid.",
                  "Add a short dilated conv; add the result to the residual.",
                  "Train the tables sparsely with a higher learning rate; serve them from wherever memory is cheap.",
                ]}
              />
            </>
          ),
        },
        {
          id: "q-off",
          title: "Last check",
          quiz: {
            question: "With Engram disabled at inference, which kind of task suffers most?",
            options: ["Reading comprehension", "Factual knowledge recall", "Both equally", "Neither - the backbone compensates"],
            answer: 1,
            explain: "Factual benchmarks drop to 29-44% of their score, reading comprehension keeps 81-93%. The table is where the static knowledge went.",
          },
        },
      ],
    },
  ],
};
