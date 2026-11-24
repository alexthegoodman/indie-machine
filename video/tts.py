"""Narration for the post videos: Kokoro-82M (ONNX) reads each scene's line.

Usage: python tts.py <job.json>
job.json = {"voice": "am_michael", "speed": 1.0, "lines": [{"id": "s0", "text": "...", "out": "path.wav"}]}
Prints one JSON line per clip: {"id", "seconds"}.
"""
import json
import sys
from pathlib import Path

import soundfile as sf
from kokoro_onnx import Kokoro

HERE = Path(__file__).parent
job = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
kokoro = Kokoro(str(HERE / "models/kokoro-v1.0.onnx"), str(HERE / "models/voices-v1.0.bin"))
for line in job["lines"]:
    samples, rate = kokoro.create(line["text"], voice=job.get("voice", "am_michael"), speed=job.get("speed", 1.0), lang="en-us")
    sf.write(line["out"], samples, rate)
    print(json.dumps({"id": line["id"], "seconds": len(samples) / rate}), flush=True)
