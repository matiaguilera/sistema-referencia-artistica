"""
Extrae de Z-Anatomy solo las estructuras de la lista blanca (config/parts.json) y las guarda,
con las transformaciones aplicadas, en un .blend limpio con dos colecciones: 'muscle' y 'skull'.

Uso:
  blender -b --disable-autoexec pipeline/build/zanatomy/Startup.blend \
      -P pipeline/scripts/extract_anatomy.py -- pipeline/config/parts.json pipeline/build/anatomy.blend

Coordenadas de salida: las de Z-Anatomy (metros, Z arriba, cara hacia -Y, lado izquierdo del modelo en +X).
Licencia de lo extraído: CC BY-SA 4.0 (Z-Anatomy, a partir de BodyParts3D).
"""
import json
import sys
import bmesh
import bpy

args = sys.argv[sys.argv.index("--") + 1:]
PARTS, OUT = args[0], args[1]
config = json.load(open(PARTS, encoding="utf-8"))


def expand(layer_cfg):
    """{s} → l / r, {S} → L / R."""
    out = {}
    for key, names in layer_cfg.items():
        if "{S}" in key:
            for s, S in (("l", "L"), ("r", "R")):
                out[key.replace("{S}", S)] = [n.replace("{s}", s) for n in names]
        else:
            out[key] = list(names)
    return out


def baked_bmesh(names):
    """Une los objetos en un bmesh, en coordenadas de mundo."""
    bm = bmesh.new()
    deps = bpy.context.evaluated_depsgraph_get()
    missing = []
    for n in names:
        obj = bpy.data.objects.get(n)
        if obj is None or obj.type != "MESH":
            missing.append(n)
            continue
        ev = obj.evaluated_get(deps)
        me = ev.to_mesh()
        me.transform(obj.matrix_world)
        bm.from_mesh(me)
        ev.to_mesh_clear()
    return bm, missing


results = {}
for layer in ("muscle", "skull"):
    for part_id, names in expand(config[layer]).items():
        bm, missing = baked_bmesh(names)
        if missing:
            print(f"WARN {part_id}: no encontrado {missing}")
        if len(bm.verts) == 0:
            bm.free()
            continue
        me = bpy.data.meshes.new(part_id)
        bm.to_mesh(me)
        bm.free()
        results[part_id] = (layer, me)

# Deja la escena solo con lo extraído: se quitan todos los objetos y colecciones originales.
# (Los datos sin usuarios no se guardan en el .blend.)
scene = bpy.context.scene
bpy.data.batch_remove(list(bpy.data.objects))
bpy.data.batch_remove(list(bpy.data.collections))
for s in list(bpy.data.scenes):
    if s != scene:
        bpy.data.scenes.remove(s)
# Las mallas originales quedan sin usuarios; se marcan para no guardarlas.
keep = {me for _, me in results.values()}
bpy.data.batch_remove([m for m in bpy.data.meshes if m not in keep])
colls = {}
for layer in ("muscle", "skull"):
    colls[layer] = bpy.data.collections.new(layer)
    bpy.context.scene.collection.children.link(colls[layer])

for part_id, (layer, me) in results.items():
    obj = bpy.data.objects.new(part_id, me)
    colls[layer].objects.link(obj)
    for p in me.polygons:
        p.use_smooth = True

print("EXTRACTED", {l: sum(1 for v in results.values() if v[0] == l) for l in colls},
      "verts", sum(len(v[1].vertices) for v in results.values()))
bpy.ops.wm.save_as_mainfile(filepath=OUT, compress=True)
print("SAVED", OUT)
