import type { Course } from "./types";
import { Bullets, Formula, Lead, Note, P, Table } from "@/components/courses/Prose";
import { CodeBlock, CodeCompare, courseSnippet } from "@/components/courses/Code";
import { MermaidBlock } from "@/components/MermaidBlock";
import { BigramCounter } from "@/components/courses/viz/BigramCounter";
import { PipelineStepper } from "@/components/courses/viz/PipelineStepper";
import { RmsNormViz } from "@/components/courses/viz/RmsNormViz";
import { CentroidSnap } from "@/components/courses/viz/CentroidSnap";
import { BigramTable, ParamCalculator } from "@/components/courses/viz/BigramTable";
import { LiveNgram } from "@/components/courses/viz/LiveNgram";
import { CentroidTraining } from "@/components/courses/viz/CentroidTraining";

const PAPER = "https://arxiv.org/abs/2207.06366";
const LUCIDRAINS = "https://github.com/lucidrains/n-grammer-pytorch";
const HYPERFIELD = "https://github.com/alexthegoodman/hyperfield";

// yumon-pet python-train/dec_model.py, Ngram.forward (verbatim).
const TORCH_FORWARD = `
def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
    b, s, w = x.shape
    with torch.autocast(x.device.type, enabled=False):
        h = x.detach().float().view(b, s, self.h, self.dh)
        h = h * torch.rsqrt(h.pow(2).mean(-1, keepdim=True) + 1e-6)
        h = h.permute(2, 0, 1, 3).reshape(self.h, b * s, self.dh)
        c = self.centroids.float()
        dist = c.detach().pow(2).sum(-1).unsqueeze(1) - 2 * h @ c.detach().transpose(1, 2)
        ids = dist.argmin(-1)  # [heads, rows]
        q = torch.gather(c, 1, ids.unsqueeze(-1).expand(-1, -1, self.dh))
        loss = (q - h).pow(2).mean() * self.loss_weight
        ids = ids.transpose(0, 1).reshape(b, s, self.h)
        prev = torch.cat([torch.full_like(ids[:, :1], self.k), ids[:, :-1]], dim=1)
        off = torch.arange(self.h, device=x.device) * ((self.k + 1) * self.k)
        emb = self.norm(self.bigrams(prev * self.k + ids + off)).reshape(b, s, w)
    return x + self.out(emb.to(x.dtype)), loss`;

// yumon-pet python-train/dec_model.py, Ngram.__init__ (verbatim).
const TORCH_INIT = `
class Ngram(nn.Module):
    def __init__(self, cfg: NgramConfig, width: int, layer: int):
        super().__init__()
        self.k, self.h = cfg.num_clusters, cfg.heads
        self.dh = width // self.h
        g = torch.Generator().manual_seed(cfg.seed + layer)
        self.centroids = nn.Parameter(torch.randn(self.h, self.k, self.dh, generator=g))
        self.bigrams = nn.Embedding(self.h * (self.k + 1) * self.k, self.dh)
        nn.init.normal_(self.bigrams.weight, 0.0, 0.02)
        self.norm = RMSNorm(self.dh)
        self.out = linear(width, width)
        nn.init.zeros_(self.out.weight)
        self.loss_weight = cfg.loss_weight`;

const PIPELINE = `flowchart LR
  X["x [b, s, w]"] --> S["split into H heads<br/>RMS-normalize"]
  S --> C["nearest of K centroids<br/>ids [b, s, H]"]
  C --> B["pair with previous id<br/>row = (h(K+1)+prev)K+id"]
  B --> E["bigram table lookup<br/>RMSNorm"]
  E --> O["out: Linear w to w<br/>(zero init)"]
  O --> A(("+"))
  X --> A
  A --> Y["y [b, s, w]"]`;

export const nGrammerCourse: Course = {
  slug: "n-grammer",
  title: "The N-Grammer Course",
  tagline: "Latent n-gram memory for transformers, one slide at a time.",
  description:
    "A free, interactive course on N-Grammer layers: product quantization, latent bigram ids, the embedding table, the centroid loss, and a working layer in PyTorch and Hyperfield (TypeScript) side by side.",
  intro: (
    <>
      N-Grammer layers (Roy et al., 2022) give a transformer a cheap lookup table keyed by <em>latent bigrams</em>: pairs of cluster ids computed from
      the model&apos;s own representations. This course takes the layer apart in six short lessons - two conceptual, two on the math, one on code and
      one on training - with interactive diagrams, quick quizzes, and a real layer that runs in your browser and matches PyTorch.
    </>
  ),
  level: "Beginner to intermediate",
  prerequisites: ["Basic Python or TypeScript", "What a tensor shape like [batch, seq, width] means", "A rough idea of what a transformer does"],
  teaches: [
    "What n-grams and bigrams are, and why a transformer might want an explicit n-gram memory",
    "Product quantization: splitting vectors into heads and snapping each to a centroid",
    "How latent bigram ids index an exact embedding table, and how big that table gets",
    "Translating a PyTorch N-Grammer layer to Hyperfield, op by op",
    "How the centroids are trained, what a dead centroid is, and why the output projection starts at zero",
  ],
  updated: "2026-11-22",
  lessons: [
    {
      slug: "what-is-an-n-gram",
      title: "What is an n-gram?",
      kind: "concept",
      minutes: 5,
      summary: "Bigrams, why counting them predicts the next word, and why N-Grammer uses latent bigrams instead of token bigrams.",
      takeaways: [
        "An n-gram is n consecutive tokens; a bigram is a pair (previous, current).",
        "A bigram table is a tiny next-token predictor built from local context.",
        "Token bigrams blow up as vocab²; N-Grammer builds bigrams over a few hundred cluster ids instead.",
      ],
      slides: [
        {
          id: "local-patterns",
          title: "Language is full of local patterns",
          body: (
            <>
              <Lead>“New” is often followed by “York”. In Rust, “fn” is followed by a name and “impl” by a type.</Lead>
              <P>
                An <strong>n-gram</strong> is a run of <strong>n</strong> consecutive tokens. A <strong>unigram</strong> is one token, a{" "}
                <strong>bigram</strong> is a pair, a <strong>trigram</strong> is three. Before neural networks, language models were mostly n-gram
                counts: look at the last token or two, and predict what usually came next.
              </P>
              <P>
                Transformers can learn these patterns too, but they have to spend attention and layers on it. The N-Grammer idea is to hand the model
                a cheap, explicit memory for “what usually follows this”, and let the rest of the network work on harder things.
              </P>
            </>
          ),
        },
        {
          id: "count",
          title: "Count some bigrams",
          body: (
            <>
              <P>Every adjacent pair is one bigram. Counting them already gives you a next-word predictor.</P>
              <BigramCounter />
            </>
          ),
        },
        {
          id: "q-bigram",
          title: "Quick check",
          quiz: {
            question: "In “the cat sat”, which pairs are the bigrams?",
            options: ["(the, cat) and (cat, sat)", "(the, sat) only", "(the, cat, sat)", "(the) (cat) (sat)"],
            answer: 0,
            explain: "A bigram is every adjacent pair of tokens. Three tokens give two bigrams. (the, cat, sat) would be a trigram; single tokens are unigrams.",
          },
        },
        {
          id: "blowup",
          title: "The problem with token bigrams",
          body: (
            <>
              <P>
                A table with one row per token pair grows with the square of the vocabulary. The Yumon model used throughout this course has 8,192
                tokens:
              </P>
              <Formula note="Most of those pairs never occur, and you would still need a vector for each one.">8,192 × 8,192 = 67,108,864 possible bigrams</Formula>
              <P>
                N-Grammer&apos;s trick is to build bigrams over something much smaller than the vocabulary. It clusters the model&apos;s own hidden
                vectors into a few hundred <strong>latent</strong> ids, and pairs those up instead. Similar tokens in similar contexts share ids, so
                they share table rows - and the table stays small enough to train.
              </P>
            </>
          ),
        },
        {
          id: "q-vocab",
          title: "Quick check",
          quiz: {
            question: "Why does N-Grammer pair up cluster ids instead of raw token ids?",
            options: [
              "Token ids can't be paired",
              "With K clusters a head has only (K+1)·K pairs, instead of vocab² token pairs",
              "Cluster ids are more accurate than tokens",
              "It makes attention unnecessary",
            ],
            answer: 1,
            explain:
              "The point is size. With K = 256 clusters a head has 257 × 256 = 65,792 possible pairs (the +1 is for “no previous token”), versus 67 million token pairs for an 8,192-token vocab.",
          },
        },
      ],
    },
    {
      slug: "the-layer-at-a-glance",
      title: "The N-Grammer layer at a glance",
      kind: "concept",
      minutes: 6,
      summary: "Where an N-Grammer layer sits in a transformer, the six steps of its forward pass, and what is learned versus computed.",
      takeaways: [
        "The layer maps [b, s, w] to [b, s, w], so it can sit in front of any block.",
        "Forward pass: split, normalize, snap to centroids, pair with the previous id, look up, project, add.",
        "Learned: centroids, the bigram table and the output projection. Computed: the ids.",
      ],
      slides: [
        {
          id: "where",
          title: "Where it sits",
          body: (
            <>
              <P>
                In the <a href={PAPER}>original paper</a> (Roy et al., 2022) the layer augments the token embeddings at the bottom of the network.
                The Yumon decoder does the same: its config says <code>&quot;ngram&quot;: {"{"} &quot;layers&quot;: [0], &quot;num_clusters&quot;: 256, &quot;heads&quot;: 16 {"}"}</code>,
                meaning one layer in front of block 0, 256 centroids, 16 heads.
              </P>
              <P>
                It takes the residual stream <code>x</code> of shape <code>[batch, seq, width]</code> and returns a tensor of the same shape, so you can
                drop it in front of any block without touching anything else.
              </P>
              <MermaidBlock chart={PIPELINE} />
            </>
          ),
        },
        {
          id: "step",
          title: "Step through one pass",
          body: (
            <>
              <P>Click through the six stages for three tokens. Watch each vector turn into two small integers, then into two table rows.</P>
              <PipelineStepper />
            </>
          ),
        },
        {
          id: "q-shape",
          title: "Quick check",
          quiz: {
            question: "x has shape [2, 10, 256]. What shape does the N-Grammer layer return?",
            options: ["[2, 10, 16]", "[2, 10, 256]", "[2, 10, 512]", "[2, 9, 256]"],
            answer: 1,
            explain:
              "The bigram embeddings are projected back to the full width and added to x, so the output shape equals the input shape. (The paper concatenates instead, which would widen it.)",
          },
        },
        {
          id: "variants",
          title: "This version vs the paper",
          body: (
            <>
              <P>
                There are a few N-Grammer variants. This course follows the one in the Yumon decoder (yumon-pet&apos;s <code>dec_model.py</code>), which
                deliberately differs from the paper and from <a href={LUCIDRAINS}>lucidrains/n-grammer-pytorch</a>:
              </P>
              <Table
                head={["", "Paper / lucidrains", "This course (Yumon)"]}
                rows={[
                  ["Bigram table", "Hashed into a fixed-size n-gram vocabulary", "Exact: one row per (prev, id) pair, (K+1)·K rows per head"],
                  ["Combine with x", "Concatenate", "Project back to width w and add"],
                  ["Centroid updates", "EMA k-means", "Centroids are parameters trained by an auxiliary loss"],
                ]}
              />
              <Note>Adding instead of concatenating keeps every width in the model unchanged, which is what makes the layer a drop-in.</Note>
            </>
          ),
        },
        {
          id: "q-learned",
          title: "Quick check",
          quiz: {
            question: "Which of these is NOT a learned parameter of the layer?",
            options: ["The centroids", "The bigram embedding table", "The output projection", "The cluster ids"],
            answer: 3,
            explain:
              "The ids are computed on every forward pass (an argmin over distances). Centroids, the bigram table and the projection are all parameters.",
          },
        },
      ],
    },
    {
      slug: "snapping-to-centroids",
      title: "Snapping to centroids: product quantization",
      kind: "math",
      minutes: 7,
      summary: "Split a vector into heads, RMS-normalize each slice, and pick the nearest centroid with the |c|² − 2h·c distance trick.",
      takeaways: [
        "Product quantization splits a width-w vector into H heads of w/H numbers, each with its own K centroids.",
        "RMS normalization first means the id depends on direction, not magnitude.",
        "argmin |h − c|² = argmin (|c|² − 2h·c): the |h|² term is the same for every centroid.",
      ],
      slides: [
        {
          id: "pq",
          title: "Many small codes instead of one big one",
          body: (
            <>
              <P>
                One codebook for a whole 256-wide vector would need an enormous number of centroids to tell vectors apart. <strong>Product
                quantization</strong> splits the vector into <strong>H heads</strong> of <code>dh = w / H</code> numbers and gives each head its own
                small codebook of <strong>K</strong> centroids.
              </P>
              <Formula note="Yumon cp1: w = 256, H = 16, so each head is a 16-number slice with its own 256 centroids.">dh = w / H = 256 / 16 = 16</Formula>
              <P>
                A vector becomes H ids, one per head. That is K<sup>H</sup> possible combinations (256<sup>16</sup> for Yumon) from only H·K
                centroids. Each head then gets its own bigram, so the layer reads H rows per token.
              </P>
            </>
          ),
        },
        {
          id: "q-dh",
          title: "Quick check",
          quiz: {
            question: "Width w = 512 and H = 8 heads. How many numbers are in each head's slice?",
            options: ["8", "64", "512", "4,096"],
            answer: 1,
            explain: "dh = w / H = 512 / 8 = 64. The width has to divide evenly by the head count, or the slices would not line up.",
          },
        },
        {
          id: "rms",
          title: "Normalize first",
          body: (
            <>
              <P>Before snapping, each slice is RMS-normalized:</P>
              <Formula note="ε = 1e-6 keeps the division safe for an all-zero slice.">ĥ = h / √(mean(h²) + ε)</Formula>
              <RmsNormViz />
            </>
          ),
        },
        {
          id: "trick",
          title: "The distance trick",
          body: (
            <>
              <P>The id is the nearest centroid by squared distance. Expand it:</P>
              <Formula>|h − c|² = |h|² − 2 h·c + |c|²</Formula>
              <P>
                For one slice <code>h</code>, the <code>|h|²</code> term is the same for every centroid, so it can&apos;t change which one wins. Drop it:
              </P>
              <Formula note="−2h·c for all centroids at once is a single matrix multiply: h @ cᵀ.">id = argmin_c ( |c|² − 2 h·c )</Formula>
              <P>
                That is exactly what the code computes: <code>c.pow(2).sum(-1) - 2 * h @ c.transpose(1, 2)</code>, then <code>argmin</code>.
              </P>
            </>
          ),
        },
        {
          id: "snap",
          title: "Try it in 2D",
          body: (
            <>
              <P>Real heads have 16 dimensions, but the geometry is the same in two. Drag the point and the centroids, and compare the two distance columns.</P>
              <CentroidSnap />
            </>
          ),
        },
        {
          id: "q-drop",
          title: "Quick check",
          quiz: {
            question: "When finding the nearest centroid, which term can safely be dropped?",
            options: ["|c|²", "−2 h·c", "|h|²", "None of them"],
            answer: 2,
            explain: "|h|² is identical for every centroid, so subtracting it shifts all distances equally and never changes the argmin. |c|² differs per centroid and must stay.",
          },
        },
        {
          id: "q-scale",
          title: "Quick check",
          quiz: {
            question: "You multiply x by 3 before the layer. Do its cluster ids change?",
            options: ["Yes, every id changes", "No - RMS normalization removes the scale", "Only for the first token", "Only if K is small"],
            answer: 1,
            explain: "Each slice is divided by its own RMS before snapping, so scaling a slice by any positive number lands it on the same normalized point.",
          },
        },
      ],
    },
    {
      slug: "bigram-ids-and-the-table",
      title: "Bigram ids and the embedding table",
      kind: "math",
      minutes: 6,
      summary: "How (previous id, id) pairs become exact rows in one embedding table, the start-of-sequence row, and how many parameters the table costs.",
      takeaways: [
        "row = (h·(K+1) + prev)·K + id, with prev = K at position 0.",
        "The table has H·(K+1)·K rows of width w/H, so (K+1)·K·w parameters - the head count cancels.",
        "In Yumon cp1 the table is 16,842,752 parameters, about 62% of the 27.2M model.",
      ],
      slides: [
        {
          id: "prev",
          title: "Look one token back",
          body: (
            <>
              <P>
                After snapping, every position has H ids. For a bigram we pair each id with the id <strong>at the previous position, in the same
                head</strong>. Shift the ids right by one:
              </P>
              <Formula note="Position 0 has no previous token. It uses the extra id K, which no real centroid has.">prev[t] = ids[t − 1],   prev[0] = K</Formula>
              <P>
                This is why the table has <strong>K + 1</strong> possible previous ids but only <strong>K</strong> current ids.
              </P>
            </>
          ),
        },
        {
          id: "row",
          title: "From a pair to a row",
          body: (
            <>
              <P>All heads share one table. Head h owns a contiguous block of (K+1)·K rows, and inside it the pair picks the row:</P>
              <Formula note="In code: prev * K + ids + h * (K + 1) * K - the same number, rearranged.">row = (h·(K+1) + prev)·K + id</Formula>
              <BigramTable />
            </>
          ),
        },
        {
          id: "q-row",
          title: "Quick check",
          quiz: {
            question: "K = 4. Head 1, previous id 2, current id 3. Which row?",
            options: ["11", "23", "31", "35"],
            answer: 2,
            explain: "(h·(K+1) + prev)·K + id = (1·5 + 2)·4 + 3 = 31. Head 1's block starts at row 20, and (prev 2, id 3) is the 11th cell inside it.",
          },
        },
        {
          id: "q-bos",
          title: "Quick check",
          quiz: {
            question: "Why does each head need (K+1)·K rows rather than K·K?",
            options: [
              "One extra row per head for padding",
              "The previous id can also be K, meaning “no previous token” at position 0",
              "K+1 centroids are trained",
              "To round up to a power of two",
            ],
            answer: 1,
            explain: "The first position pairs its id with the special previous id K. That adds K rows per head: one per current id.",
          },
        },
        {
          id: "size",
          title: "How big is the table?",
          body: (
            <>
              <P>
                Each row has <code>dh = w / H</code> numbers and there are <code>H·(K+1)·K</code> rows, so the H cancels: the table costs{" "}
                <code>(K+1)·K·w</code> parameters no matter how many heads you use.
              </P>
              <ParamCalculator />
              <P>
                For Yumon cp1 that is 16,842,752 parameters, about 62% of the 27.2M model - yet each token only reads 16 rows of 16 numbers. Sparse
                lookups like this are cheap at inference time; the paper&apos;s pitch is exactly that trade: lots of parameters, little compute.
              </P>
            </>
          ),
        },
        {
          id: "q-size",
          title: "Quick check",
          quiz: {
            question: "K = 4, H = 2, w = 8. How many rows does the table have?",
            options: ["16", "32", "40", "64"],
            answer: 2,
            explain: "H·(K+1)·K = 2 · 5 · 4 = 40 rows, each w/H = 4 wide. This is the tiny layer the next lesson runs in your browser.",
          },
        },
      ],
    },
    {
      slug: "pytorch-to-hyperfield",
      title: "Coding it: PyTorch to Hyperfield",
      kind: "code",
      minutes: 8,
      summary: "The N-Grammer forward pass in PyTorch and in Hyperfield (TypeScript, WebGPU/CPU) side by side, an op-by-op mapping, and a live layer that matches PyTorch.",
      takeaways: [
        "Most ops map one to one: view/reshape, pow(2)/square, rsqrt, matmul, cat, nn.Linear/linear.",
        "Hyperfield has no argmin here, so the code uses neg().argmax().",
        "nn.Embedding is a row gather: indexSelect(0, rows) on the table.",
        "The course's layer gives identical ids and outputs within 2.4e-7 of PyTorch 2.14.1.",
      ],
      slides: [
        {
          id: "setup",
          title: "Two libraries, one layer",
          body: (
            <>
              <P>
                <a href={HYPERFIELD}>Hyperfield</a> is a TypeScript ML library with a PyTorch-style API that runs on WebGPU or a CPU backend (npm{" "}
                <code>hyperfield@0.1.0</code>). On the left is the real layer from the Yumon PyTorch trainer; on the right is the parameter setup the
                tiny course layer uses, built from plain tensors so you can see every piece.
              </P>
              <CodeCompare>
                <CodeBlock lang="python" label="PYTORCH" source="yumon-pet python-train/dec_model.py" code={TORCH_INIT} />
                <CodeBlock lang="ts" label="HYPERFIELD" source="lib/courses/tiny-ngrammer.ts" code={courseSnippet("tiny-ngrammer.ts", "export function demoWeights")} />
              </CodeCompare>
              <Note>
                Note the init on the left: <code>nn.init.zeros_(self.out.weight)</code>. Lesson 6 explains why the projection starts at zero. The demo
                weights on the right use a non-zero projection so you can see the layer do something.
              </Note>
            </>
          ),
        },
        {
          id: "forward",
          title: "The forward pass in both",
          body: (
            <>
              <P>Same five steps in both. Read them line against line - the numbered comments in the Hyperfield version follow the PyTorch order.</P>
              <CodeCompare>
                <CodeBlock lang="python" label="PYTORCH" source="Ngram.forward" code={TORCH_FORWARD} />
                <CodeBlock lang="ts" label="HYPERFIELD" source="ngramLayer" code={courseSnippet("tiny-ngrammer.ts", "export function ngramLayer")} />
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
                ["Split heads", <code key="a">x.view(b, s, H, dh)</code>, <code key="b">x.reshape([b, s, H, dh])</code>, "Shapes are arrays in Hyperfield"],
                ["RMS norm", <code key="a">h.pow(2).mean(-1, keepdim=True)</code>, <code key="b">h.square().mean(-1, true)</code>, "keepdim is positional"],
                ["Heads first", <code key="a">permute(2, 0, 1, 3).reshape(...)</code>, <code key="b">reshape([b*s, H, dh]).transpose(0, 1)</code>, "Same [heads, rows, dh] result"],
                ["Distances", <code key="a">h @ c.transpose(1, 2)</code>, <code key="b">h.matmul(c.transpose(1, 2))</code>, "Batched over heads"],
                ["Nearest", <code key="a">dist.argmin(-1)</code>, <code key="b">dist.neg().argmax(-1)</code>, "argmin(d) = argmax(−d)"],
                ["Shift right", <code key="a">torch.cat([torch.full_like(...), ids[:, :-1]], 1)</code>, <code key="b">hf.cat([hf.full(...), ids.indexSelect(1, hf.arange(s - 1))], 1)</code>, "No slicing syntax; gather the first s−1 positions"],
                ["Table lookup", <code key="a">self.bigrams(rows)</code>, <code key="b">bigrams.indexSelect(0, rows)</code>, "nn.Embedding is a row gather"],
                ["Projection", <code key="a">self.out(emb)</code>, <code key="b">hf.linear(emb, out)</code>, "Both compute emb @ outᵀ"],
                ["No gradient", <code key="a">x.detach()</code>, <code key="b">(inference only)</code>, "Hyperfield has .detach() and hf.noGrad() for training"],
              ]}
            />
          ),
        },
        {
          id: "q-argmin",
          title: "Quick check",
          quiz: {
            question: "The Hyperfield version has no argmin. How does it find the nearest centroid?",
            options: ["Sorts the distances", "dist.neg().argmax(-1)", "dist.max(-1)", "It loops over centroids in JavaScript"],
            answer: 1,
            explain: "The smallest distance is the largest negated distance, so argmax of −dist gives the same index - on the GPU, in one op.",
          },
        },
        {
          id: "live",
          title: "Run it in your browser",
          body: (
            <>
              <P>
                This table is computed by <code>ngramLayer</code> from the previous slide, live, with Hyperfield in this page. Type your own words. A
                repeated phrase like “the cat” reads the same rows each time it appears.
              </P>
              <LiveNgram />
            </>
          ),
        },
        {
          id: "parity",
          title: "Does it match PyTorch?",
          body: (
            <>
              <P>
                The course repo has a parity test. It runs <code>ngramLayer</code> on Hyperfield&apos;s CPU backend, writes the weights and input to
                JSON, and loads them into the real <code>Ngram</code> module from yumon-pet&apos;s <code>dec_model.py</code>:
              </P>
              <Formula>node tests/courses-parity.mjs</Formula>
              <Table
                head={["Check", "Result"]}
                rows={[
                  ["Cluster ids, 10 tokens × 2 heads", "Identical"],
                  ["Max absolute output error", "2.38e-7"],
                  ["Reference", "PyTorch 2.14.1+cpu, fp32"],
                  ["Hyperfield", "0.1.0, CPU backend, Node 24.11"],
                ]}
              />
              <P>
                The full Yumon model in Hyperfield (27.2M parameters, the same N-Grammer layer at K = 256 and 16 heads) matches PyTorch logits to
                2.5e-5 on WebGPU, per the Hyperfield README.
              </P>
            </>
          ),
        },
        {
          id: "q-linear",
          title: "Quick check",
          quiz: {
            question: "PyTorch's nn.Linear(w, w) stores weight W of shape [out, in]. What does hf.linear(x, W) compute?",
            options: ["W @ x", "x @ W", "x @ Wᵀ", "x * W elementwise"],
            answer: 2,
            explain: "Both use the [out, in] layout and compute x @ Wᵀ, which is why PyTorch state dicts load into Hyperfield without transposing anything.",
          },
        },
      ],
    },
    {
      slug: "training-the-layer",
      title: "Training it: centroid loss and zero init",
      kind: "concept",
      minutes: 7,
      summary: "Why the ids get no gradient, how the auxiliary centroid loss trains the codebook, what dead centroids are, and why a fresh layer is a no-op.",
      takeaways: [
        "argmin has no gradient, so centroids are trained by loss_weight · mean |c_id − h|² with h detached.",
        "The bigram table and projection learn through the language-model loss as usual.",
        "A centroid no slice is nearest to gets zero gradient forever - a dead centroid.",
        "The zero-initialized projection makes a fresh layer return x exactly.",
      ],
      slides: [
        {
          id: "no-grad",
          title: "The ids can't be trained by backprop",
          body: (
            <>
              <P>
                <code>argmin</code> returns an integer. Nudge a centroid a little and the id usually doesn&apos;t change at all, so there is no useful
                gradient through it. The language-model loss can train the bigram table and the projection (they are on the path to the output), but not
                the centroids.
              </P>
              <P>So the layer adds its own small loss that pulls each chosen centroid toward the slices that chose it:</P>
              <Formula note="q = the chosen centroid for each slice. Yumon uses loss_weight = 0.25 and adds this to the LM loss.">
                loss = loss_weight · mean( (c_id − detach(h))² )
              </Formula>
              <P>
                <code>h</code> is detached, so this loss only moves the centroids - it never drags the model&apos;s hidden states toward the codebook. It
                is k-means, done with gradient descent.
              </P>
            </>
          ),
        },
        {
          id: "train",
          title: "Watch the centroids learn",
          body: (
            <>
              <P>Ninety 2D points in three groups, four centroids. Press train and watch the loss fall.</P>
              <CentroidTraining />
            </>
          ),
        },
        {
          id: "q-loss",
          title: "Quick check",
          quiz: {
            question: "Which parameters does the centroid loss update?",
            options: ["Only the centroids", "The centroids and the hidden states", "The bigram table", "Every parameter in the model"],
            answer: 0,
            explain: "h is detached inside the loss, and the bigram table and projection are not in it. Only the gathered centroids get gradient.",
          },
        },
        {
          id: "dead",
          title: "Dead centroids",
          body: (
            <>
              <P>
                A centroid that is never the nearest one for any slice gets no gradient, so it never moves, so it is never chosen. Its rows in the bigram
                table never train either. In the demo, centroid 3 is dead from the start.
              </P>
              <P>
                EMA k-means implementations commonly fight this by re-seeding unused centroids from recent data. The Yumon version documents that it does
                not re-seed yet - worth knowing if you train one: count how many ids are actually used per head.
              </P>
              <Note title="TRY IT">Reset the demo, drag the learning rate to 20 and train. Then think about where you would re-seed centroid 3 to rescue it.</Note>
            </>
          ),
        },
        {
          id: "zero",
          title: "A fresh layer does nothing - on purpose",
          body: (
            <>
              <P>
                The output projection starts at zero (<code>nn.init.zeros_(self.out.weight)</code>), so on step 0, <code>out(emb) = 0</code> and the
                layer returns <code>x</code> unchanged. A model with the layer starts as the exact same function as one without it, which makes A/B runs
                fair and keeps early training stable. The projection grows only as fast as the bigram memory proves useful.
              </P>
              <P>Slide the projection scale up from zero and watch |y − x| appear:</P>
              <LiveNgram showScale initial="the cat sat on the mat" />
            </>
          ),
        },
        {
          id: "q-zero",
          title: "Quick check",
          quiz: {
            question: "What does a freshly initialized layer return?",
            options: ["Zeros", "x, exactly", "Random noise added to x", "The bigram embeddings"],
            answer: 1,
            explain: "With a zero projection, x + out(emb) = x + 0. The layer is a no-op until training moves the projection away from zero.",
          },
        },
        {
          id: "cache",
          title: "One more thing: generation",
          body: (
            <>
              <P>
                When generating one token at a time with a KV cache, the new token still needs its previous id. The Hyperfield port of Yumon stores each
                N-Grammer layer&apos;s last-position ids in the cache next to the keys and values, so a cached step pairs the new id with them instead of
                with the start id K. Cached logits equal the full forward pass exactly.
              </P>
              <Bullets
                items={[
                  "Split, normalize, snap: a vector becomes H small ids.",
                  "Pair each id with the previous one: an exact row in one table.",
                  "Look up, normalize, project, add - shape in equals shape out.",
                  "Centroids learn from their own loss; the projection starts at zero.",
                ]}
              />
            </>
          ),
        },
        {
          id: "q-cache",
          title: "Last check",
          quiz: {
            question: "During cached generation, what extra state does an N-Grammer layer need?",
            options: ["Nothing", "All previous hidden states", "The previous position's cluster ids", "The whole bigram table per step"],
            answer: 2,
            explain: "A bigram only looks one position back, so the layer just needs the last position's H ids to form the new token's pairs.",
          },
        },
      ],
    },
  ],
};
