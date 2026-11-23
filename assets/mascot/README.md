# Yumon mascot sources

Meshy tasks behind `public/models/mascot/*.glb` (each GLB = mesh + 24-joint rig + one texture + six clips).
Re-download any stage with `meshy <resource> get <task> -o <dir>` while Meshy keeps the task.

| Stage | SOFT (`yumon-bot.glb`) | MECH (`yumon-mech.glb`) |
|---|---|---|
| text-to-image (gpt-image-2-5-flare, A-pose) | `01a209dd-2bf0-71a9-ae7c-bdcfd6abeb3f` -> `concept/` | `01a209e1-a4be-77f0-9641-0b16b4d74e27` -> `concept-real/` |
| image-to-3d (meshy-t2.5 smart topology, meshy-n1 texture) | `01a209dd-bcaa-7017-89df-df969965c608`, 10k tris -> `model/` | `01a209e2-4d27-731d-98f8-a647d7d0fbe5`, 20k tris -> `model-real/` |
| rigging | `01a209de-db93-713d-8a75-d7f8bf278e13` (1.2 m) | `01a209e3-2cc4-7690-a5fa-e4b0729f1c0c` (1.8 m) |
| animate, action ids 0,28,36,313,49,38 | `01a209df-8589-74c2-911f-37293701d286` | `01a209e3-70c6-7645-b8f5-41082eab6256` |

Clips: Idle, Big_Wave_Hello, Confused_Scratch, Talk_with_Hands_Open, Motivational_Cheer, Dozing_Elderly.
Both robots together cost 94 Meshy credits (2026-11-23).
