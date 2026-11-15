"""
Genera la piel genérica (cuerpo completo, sin pelo ni ropa) con MPFB2 y la guarda en un .blend.

Uso:
  blender -b --factory-startup? NO (hace falta el addon MPFB del usuario):
  blender -b --disable-autoexec -P pipeline/scripts/build_skin.py -- male   pipeline/build/skin_male.blend
  blender -b --disable-autoexec -P pipeline/scripts/build_skin.py -- female pipeline/build/skin_female.blend

Salida: objetos "skin" (malla del cuerpo, solo el grupo 'body') y "eye_L" / "eye_R"
(las esferas auxiliares de ojo de la malla base de MakeHuman), en metros, Z arriba, cara hacia -Y.

Licencia: la malla base y los targets de MakeHuman/MPFB son CC0.
"""
import sys
import bpy
import bmesh

from bl_ext.blender_org.mpfb.services.humanservice import HumanService
from bl_ext.blender_org.mpfb.services.targetservice import TargetService

args = sys.argv[sys.argv.index("--") + 1:]
SEX, OUT = args[0], args[1]

# Parámetros "promedio": 25 años (age 0.5 en MakeHuman), proporciones, peso y musculatura
# medios, mezcla étnica equilibrada. Solo cambia el género.
MACROS = {
    "gender": 1.0 if SEX == "male" else 0.0,
    "age": 0.5,
    "muscle": 0.5,
    "weight": 0.5,
    "proportions": 0.5,
    "height": 0.5,
    "cupsize": 0.5,
    "firmness": 0.5,
    "race": {"asian": 1 / 3, "caucasian": 1 / 3, "african": 1 / 3},
}

# Escena limpia
bpy.ops.wm.read_homefile(use_empty=True)

human = HumanService.create_human(
    mask_helpers=False, detailed_helpers=True, extra_vertex_groups=True,
    feet_on_ground=True, scale=0.1, macro_detail_dict=MACROS,
)
# Hornea los shape keys (los targets) en la malla.
TargetService.bake_targets(human)


def split_group(src, group_name, new_name, keep_groups=()):
    """Duplica los vértices del grupo en un objeto nuevo (conserva los grupos de keep_groups)."""
    gi = src.vertex_groups[group_name].index
    me = src.data.copy()
    obj = bpy.data.objects.new(new_name, me)
    bpy.context.scene.collection.objects.link(obj)
    obj.matrix_world = src.matrix_world
    # Los pesos viven en la malla; los nombres de grupo, en el objeto.
    for vg in src.vertex_groups:
        obj.vertex_groups.new(name=vg.name)
    bm = bmesh.new()
    bm.from_mesh(me)
    deform = bm.verts.layers.deform.active
    kill = [v for v in bm.verts if gi not in v[deform] or v[deform][gi] < 0.5]
    bmesh.ops.delete(bm, geom=kill, context="VERTS")
    bm.to_mesh(me)
    bm.free()
    for vg in list(obj.vertex_groups):
        if vg.name not in keep_groups:
            obj.vertex_groups.remove(vg)
    return obj


eyes = {}
for side_mh in ("l", "r"):
    eyes[side_mh] = split_group(human, f"helper-{side_mh}-eye", f"eye_tmp_{side_mh}")

# 'ears', 'lips' y 'scalp' se usan en el ajuste (grosor de tejido por región).
skin = split_group(human, "body", "skin", keep_groups=("ears", "lips", "scalp"))
bpy.data.objects.remove(human, do_unlink=True)

# Nombra los ojos según la posición: el lado izquierdo del modelo está en +X.
for obj in eyes.values():
    cx = sum((obj.matrix_world @ v.co).x for v in obj.data.vertices) / len(obj.data.vertices)
    obj.name = obj.data.name = "eye_L" if cx > 0 else "eye_R"
skin.data.name = "skin"

for o in bpy.context.scene.objects:
    print("OBJ", o.name, len(o.data.vertices), [round(v, 3) for v in o.dimensions])

bpy.ops.wm.save_as_mainfile(filepath=OUT, compress=True)
print("SAVED", OUT)
