# Post videos

Procedural 30-90 s summary videos for posts, 1920x1080 at 30 fps. Each video uses its post's own intro shader and palette (`lib/experience.ts` + `lib/experience-shaders.ts`), with a HUD frame, narration by Kokoro-82M, burned-in captions and a synth music bed seeded by the slug.

```
node video/build.mjs <slug>            # -> video/out/<slug>/<slug>.mp4 + <slug>.jpg poster
node video/build.mjs <slug> --stills   # one JPG per scene, no audio/encode
  --voice af_heart   --speed 1.1       # override the storyboard / defaults
```

## Setup (once)

```
cd video
uv venv --python 3.12 .venv
uv pip install --python .venv/Scripts/python.exe kokoro-onnx soundfile
mkdir models   # then download into it:
#   https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
#   https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
```

Also needs `ffmpeg` on PATH, system Chrome, and `playwright-core` (found in `node_modules`, `../hyperfield/node_modules`, or `PLAYWRIGHT_CORE=<dir>`).

## Storyboards

`storyboards/<slug>.json` holds the script; everything else comes from the post's frontmatter (title, kind, series, date, scores).

| scene `type` | fields |
|---|---|
| `intro` | `say` |
| `point` | `kicker`, `head`, `say`, optional `sub`, optional `visual` |
| `scores` | `say` (rows come from frontmatter `scores`) |
| `verdict` | `head`, `say`, optional `kicker`, `pros`, `cons` |
| `outro` | `say`, optional `head` |

`say` is the caption; `speak` (optional) is what the TTS reads, for pronunciation ("clone-three", "A.P.I."). Scene length follows the narration.

Visuals (`visual.kind`): `image` (`src` under `public/`, `label`, `fit`), `stat` (`value`, `unit`, `label`, `sub`), `bars` (`items: [{label, value, display?, highlight?}]`, `unit`, `log`), `code` (`lines`, `file`, `size`), `list` (`items`), `chips` (`items`).

## Files

- `build.mjs` - TTS, timeline, voice track + caption timing, music, ffmpeg mix (sidechain duck, loudnorm -16 LUFS), frame loop, encode
- `renderer/` - the canvas page rendered in headless Chrome; `VIDEO.frame(t)` is a pure function of `t`
- `music.mjs` - procedural music + WAV IO
- `tts.py` - Kokoro ONNX narration
