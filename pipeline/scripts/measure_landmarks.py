"""
Vuelve a medir las líneas de proporción sobre un modelo ya ensamblado (sin repetir el ajuste)
y actualiza su meta.json.

Uso:
  blender -b --disable-autoexec pipeline/build/male/assembled.blend \
      -P pipeline/scripts/measure_landmarks.py -- pipeline/build/male/meta.json
"""
import json
import os
import sys

import bpy
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import landmarks_lib  # noqa: E402

meta_path = sys.argv[sys.argv.index("--") + 1]


def V(obj):
    a = np.empty(len(obj.data.vertices) * 3)
    obj.data.vertices.foreach_get("co", a)
    a = a.reshape(-1, 3)
    M = np.array(obj.matrix_world)
    return a @ M[:3, :3].T + M[:3, 3]


skin = bpy.data.objects["skin"]
# En assembled.blend el origen ya está entre los ojos (z = 0).
E = (V(bpy.data.objects["eye_L"]).mean(0) + V(bpy.data.objects["eye_R"]).mean(0)) / 2
LM = landmarks_lib.measure(V(skin), E)
meta = json.load(open(meta_path))
meta["landmarks"] = {
    "top": round(LM["top"], 4),
    "browLine": round(LM["brow"], 4),
    "eyeLine": 0.0,
    "noseBase": round(LM["nose_base"], 4),
    "mouthLine": round(LM["mouth"], 4),
    "chin": round(LM["chin"], 4),
}
json.dump(meta, open(meta_path, "w"), indent=2)
print("[measure]", json.dumps(meta["landmarks"]))
