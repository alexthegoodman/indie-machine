"""PyTorch side of tests/courses-parity.mjs: runs yumon-pet's real `Ngram` layer
(python-train/dec_model.py) on the weights and input the Hyperfield test wrote, and prints
its cluster ids and output as JSON.

    <yumon-pet venv python> -I tests/courses_parity_reference.py <python-train dir> <case.json>
"""
import json
import sys

import torch

sys.path.insert(0, sys.argv[1])
from dec_model import Ngram, NgramConfig  # noqa: E402

case = json.load(open(sys.argv[2]))
width, heads, k = case["width"], case["heads"], case["k"]
layer = Ngram(NgramConfig(layers=[0], num_clusters=k, heads=heads), width, 0).eval()
with torch.no_grad():
    layer.centroids.copy_(torch.tensor(case["centroids"]).view(heads, k, width // heads))
    layer.bigrams.weight.copy_(torch.tensor(case["bigrams"]).view(-1, width // heads))
    layer.out.weight.copy_(torch.tensor(case["out"]).view(width, width))
    x = torch.tensor(case["x"]).view(1, -1, width)
    y, loss = layer(x)
    # Recompute the ids the same way forward does, for comparison.
    b, s, _ = x.shape
    h = x.view(b, s, heads, width // heads)
    h = h * torch.rsqrt(h.pow(2).mean(-1, keepdim=True) + 1e-6)
    h = h.permute(2, 0, 1, 3).reshape(heads, b * s, -1)
    c = layer.centroids
    ids = (c.pow(2).sum(-1).unsqueeze(1) - 2 * h @ c.transpose(1, 2)).argmin(-1).transpose(0, 1)
print(json.dumps({"torch": torch.__version__, "ids": ids.flatten().tolist(), "y": y.flatten().tolist(), "loss": loss.item()}))
