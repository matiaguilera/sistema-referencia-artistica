"""
Ensambla un modelo de Head Study: piel (MPFB2) + músculos y cráneo (Z-Anatomy), alineados.

Pasos:
  1. Subdivide la piel y reemplaza las esferas auxiliares de los ojos por esferas lisas.
  2. Reduce polígonos de la anatomía (Decimate).
  3. Ajuste global: escala por eje + traslación a partir de referencias anatómicas
     (centro de los ojos, vértice, mentón, glabela, occipucio y ancho del cráneo),
     sumando grosores típicos de tejido blando sobre el hueso.
  4. Recorta cabeza y cuello (plano bajo la escotadura yugular + dos planos laterales);
     la piel recibe tapas.
  5. Ajuste fino no rígido: desde la piel se lanzan rayos hacia adentro; donde la anatomía queda
     demasiado honda o atraviesa la piel, se corrige y el desplazamiento se interpola
     suavemente (núcleo gaussiano) a todos los vértices de la anatomía.
  6. Lleva el origen al centro de la cabeza a la altura de los ojos y exporta un GLB por capa
     (Y arriba, cara hacia +Z) más un JSON con encuadre y líneas de proporción.

Uso:
  blender -b --disable-autoexec -P pipeline/scripts/assemble.py -- \
      --skin pipeline/build/skin_male.blend --anatomy pipeline/build/anatomy.blend \
      --out pipeline/build/male
"""
import argparse
import json
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import landmarks_lib  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--skin", required=True)
ap.add_argument("--anatomy", required=True)
ap.add_argument("--out", required=True, help="carpeta de salida (GLB sin comprimir + meta.json)")
ap.add_argument("--muscle-tris", type=int, default=140_000)
ap.add_argument("--skull-tris", type=int, default=140_000)
ap.add_argument("--refine-iterations", type=int, default=3)
A = ap.parse_args(sys.argv[sys.argv.index("--") + 1:])
os.makedirs(A.out, exist_ok=True)


def log(*a):
    print("[assemble]", *a, flush=True)


# ----------------------------------------------------------------- utilidades
def V(obj):
    n = len(obj.data.vertices)
    a = np.empty(n * 3, dtype=np.float64)
    obj.data.vertices.foreach_get("co", a)
    a = a.reshape(-1, 3)
    M = np.array(obj.matrix_world)
    return a @ M[:3, :3].T + M[:3, 3]


def set_V(obj, a):
    M = np.linalg.inv(np.array(obj.matrix_world))
    local = a @ M[:3, :3].T + M[:3, 3]
    obj.data.vertices.foreach_set("co", local.astype(np.float64).ravel())
    obj.data.update()


def normals(obj):
    n = len(obj.data.vertices)
    a = np.empty(n * 3, dtype=np.float64)
    obj.data.vertices.foreach_get("normal", a)
    return a.reshape(-1, 3)


def group_mask(obj, name, threshold=0.5):
    mask = np.zeros(len(obj.data.vertices), dtype=bool)
    vg = obj.vertex_groups.get(name)
    if vg is None:
        return mask
    gi = vg.index
    for v in obj.data.vertices:
        for g in v.groups:
            if g.group == gi and g.weight >= threshold:
                mask[v.index] = True
    return mask


def apply_modifier(obj, mod):
    with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj]):
        bpy.ops.object.modifier_apply(modifier=mod.name)


def tri_count(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def concat(objs):
    return np.concatenate([V(o) for o in objs]) if objs else np.zeros((0, 3))


# ----------------------------------------------------------------- 1. piel
bpy.ops.wm.open_mainfile(filepath=A.skin)
skin = bpy.data.objects["skin"]
sub = skin.modifiers.new("subsurf", "SUBSURF")
sub.levels = sub.render_levels = 1
apply_modifier(skin, sub)
for p in skin.data.polygons:
    p.use_smooth = True

eyes = {}
for side in ("L", "R"):
    src = bpy.data.objects[f"eye_{side}"]
    pts = V(src)
    c = pts.mean(axis=0)
    r = float(np.linalg.norm(pts - c, axis=1).mean())
    me = bpy.data.meshes.new(f"eye_{side}")
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=24, radius=r)
    bmesh.ops.translate(bm, verts=bm.verts, vec=Vector(c))
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    bpy.data.objects.remove(src, do_unlink=True)
    obj = bpy.data.objects.new(f"eye_{side}", me)
    bpy.context.scene.collection.objects.link(obj)
    eyes[side] = obj

# ----------------------------------------------------------------- 2. anatomía
with bpy.data.libraries.load(A.anatomy, link=False) as (src, dst):
    dst.collections = [c for c in src.collections if c in ("muscle", "skull")]
layers = {}
for coll in dst.collections:
    bpy.context.scene.collection.children.link(coll)
    layers[coll.name] = list(coll.objects)
anat = layers["muscle"] + layers["skull"]
part = {o.name: o for o in anat}

# Algunas mallas de BodyParts3D tienen caras con orientación mezclada: se unifica hacia afuera
# (si no, las normales suavizadas se promedian mal y aparecen manchas oscuras).
for o in anat:
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(o.data)
    bm.free()

for layer, target in (("muscle", A.muscle_tris), ("skull", A.skull_tris)):
    objs = layers[layer]
    total = sum(tri_count(o) for o in objs)
    ratio = min(1.0, target / max(total, 1))
    for o in objs:
        t = tri_count(o)
        r = min(1.0, max(ratio, 800 / max(t, 1)))
        if r < 0.98:
            m = o.modifiers.new("decimate", "DECIMATE")
            m.ratio = r
            apply_modifier(o, m)
        for p in o.data.polygons:
            p.use_smooth = True
    log(f"{layer}: {total} → {sum(tri_count(o) for o in objs)} triángulos")


# ----------------------------------------------------------------- 3. ajuste global
def band(pts, axis, lo, hi):
    return pts[(pts[:, axis] >= lo) & (pts[:, axis] <= hi)]


def landmarks_skin():
    sv = V(skin)
    eL, eR = V(eyes["L"]).mean(0), V(eyes["R"]).mean(0)
    E = (eL + eR) / 2
    mid = np.abs(sv[:, 0]) < 0.006
    top = sv[np.abs(sv[:, 0]) < 0.03, 2].max()
    # Mentón: punto más bajo de la línea media por delante de los ojos, en una ventana
    # que excluye el pecho (el mentón queda ~11–13 cm bajo los ojos).
    zwin = (sv[:, 2] < E[2] - 0.05) & (sv[:, 2] > E[2] - 0.17)
    chin = sv[mid & (sv[:, 1] < E[1] + 0.005) & zwin, 2].min()
    back = band(sv[mid], 2, E[2], E[2] + 0.07)[:, 1].max()
    glab = band(sv[mid], 2, E[2] + 0.005, E[2] + 0.03)[:, 1].min()
    halfw = np.abs(band(sv, 2, E[2] + 0.03, E[2] + 0.07)[:, 0]).max()
    return dict(eL=eL, eR=eR, E=E, top=top, chin=chin, back=back, glab=glab, halfw=halfw)


def landmarks_anatomy():
    eL, eR = V(part["eyeball_L"]).mean(0), V(part["eyeball_R"]).mean(0)
    E = (eL + eR) / 2
    vault = concat([part[n] for n in ("epicranial_aponeurosis_L", "epicranial_aponeurosis_R",
                                      "parietal_bone_L", "parietal_bone_R", "frontal_bone")])
    top = vault[:, 2].max() + 0.004
    mand = V(part["mandible"])
    mmid = mand[(np.abs(mand[:, 0]) < 0.006) & (mand[:, 1] < E[1] + 0.005)]
    chin = mmid[:, 2].min() - 0.007
    occ = concat([part[n] for n in ("occipital_bone", "occipitalis_L", "occipitalis_R",
                                    "epicranial_aponeurosis_L", "epicranial_aponeurosis_R")])
    back = band(occ[np.abs(occ[:, 0]) < 0.006], 2, E[2], E[2] + 0.07)[:, 1].max() + 0.004
    front = concat([part["frontal_bone"]])
    glab = band(front[np.abs(front[:, 0]) < 0.006], 2, E[2] + 0.005, E[2] + 0.03)[:, 1].min() - 0.005
    side = concat([part[n] for n in ("temporalis_L", "temporalis_R", "parietal_bone_L", "parietal_bone_R",
                                     "epicranial_aponeurosis_L", "epicranial_aponeurosis_R")])
    halfw = np.abs(band(side, 2, E[2] + 0.03, E[2] + 0.07)[:, 0]).max() + 0.004
    return dict(eL=eL, eR=eR, E=E, top=top, chin=chin, back=back, glab=glab, halfw=halfw)


def fit_axis(src, dst):
    X = np.stack([np.asarray(src, float), np.ones(len(src))], axis=1)
    s, t = np.linalg.lstsq(X, np.asarray(dst, float), rcond=None)[0]
    return s, t


S = landmarks_skin()
Aa = landmarks_anatomy()
sx, tx = fit_axis([Aa["eL"][0], Aa["eR"][0], Aa["halfw"], -Aa["halfw"]], [S["eL"][0], S["eR"][0], S["halfw"], -S["halfw"]])
sy, ty = fit_axis([Aa["E"][1], Aa["back"], Aa["glab"]], [S["E"][1], S["back"], S["glab"]])
sz, tz = fit_axis([Aa["E"][2], Aa["top"], Aa["chin"]], [S["E"][2], S["top"], S["chin"]])
log(f"escala x={sx:.3f} y={sy:.3f} z={sz:.3f}  traslación=({tx:.3f}, {ty:.3f}, {tz:.3f})")
scale, shift = np.array([sx, sy, sz]), np.array([tx, ty, tz])
for o in anat:
    set_V(o, V(o) * scale + shift)

# ----------------------------------------------------------------- 4. recorte
man_top = V(part["manubrium"])[:, 2].max()
ZC = man_top - 0.02
XC = 0.095 * sx
PLANES = [((0, 0, ZC), (0, 0, -1)), ((XC, 0, 0), (1, 0, 0)), ((-XC, 0, 0), (-1, 0, 0))]


def clip(obj, fill=False):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.transform(obj.matrix_world)
    for co, no in PLANES:
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-7, plane_co=co, plane_no=no, clear_outer=True)
    if fill:
        def on_cut(v):
            return any(abs((v.co - Vector(co)).dot(Vector(no))) < 1e-5 for co, no in PLANES)
        edges = [e for e in bm.edges if e.is_boundary and on_cut(e.verts[0]) and on_cut(e.verts[1])]
        res = bmesh.ops.holes_fill(bm, edges=edges, sides=0)
        if res["faces"]:
            bmesh.ops.triangulate(bm, faces=res["faces"])
    bm.transform(obj.matrix_world.inverted())
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return len(obj.data.vertices)


clip(skin, fill=True)
for o in list(anat):
    if clip(o) == 0:
        log("fuera del recorte:", o.name)
        anat.remove(o)
        bpy.data.objects.remove(o, do_unlink=True)
part = {o.name: o for o in anat}
log(f"recorte: z > {ZC:.3f}, |x| < {XC:.3f}")


# ----------------------------------------------------------------- 5. ajuste fino
def anatomy_bvh():
    verts, polys, off = [], [], 0
    for o in anat:
        pts = V(o)
        verts.extend(map(tuple, pts))
        polys.extend(tuple(i + off for i in p.vertices) for p in o.data.polygons)
        off += len(pts)
    return BVHTree.FromPolygons(verts, polys, all_triangles=False)


sv_all = V(skin)
nv_all = normals(skin)
ears = group_mask(skin, "ears")
lips = group_mask(skin, "lips")
scalp = group_mask(skin, "scalp")
near_cut = (sv_all[:, 2] < ZC + 0.006) | (np.abs(sv_all[:, 0]) > XC - 0.006)
valid = ~ears & ~near_cut & (np.linalg.norm(nv_all, axis=1) > 0.5)
idx = np.flatnonzero(valid)
idx = idx[:: max(1, len(idx) // 3500)]
thick = np.full(len(sv_all), 0.004)
thick[scalp] = 0.005
thick[lips] = 0.006
thick[sv_all[:, 2] < S["chin"]] = 0.005
log(f"muestras de piel: {len(idx)}")

SIGMA, EPS = 0.012, 0.25
for it in range(A.refine_iterations):
    bvh = anatomy_bvh()
    ctrl, disp = [], []
    for i in idx:
        p, n, t = Vector(sv_all[i]), Vector(nv_all[i]).normalized(), thick[i]
        hit = bvh.ray_cast(p, n, 0.012)
        if hit[0] is not None:  # la anatomía atraviesa la piel
            r = -(hit[3] + t)
        else:
            hit = bvh.ray_cast(p, -n, 0.015)
            if hit[0] is None:
                continue
            r = hit[3] - t
        r = max(-0.01, min(0.01, r))
        if abs(r) < 2e-4:
            continue
        ctrl.append(tuple(hit[0]))
        disp.append(tuple(n * r))
    C, D = np.array(ctrl), np.array(disp)
    log(f"iteración {it + 1}: {len(C)} controles, corrección media {np.linalg.norm(D, axis=1).mean() * 1000:.1f} mm, "
        f"máx {np.linalg.norm(D, axis=1).max() * 1000:.1f} mm")
    if len(C) == 0:
        break
    for o in anat:
        X = V(o)
        out = np.empty_like(X)
        for s in range(0, len(X), 4000):
            x = X[s:s + 4000]
            d2 = ((x[:, None, :] - C[None, :, :]) ** 2).sum(-1)
            W = np.exp(-d2 / SIGMA ** 2)
            out[s:s + 4000] = x + (W @ D) / (W.sum(1, keepdims=True) + EPS)
        set_V(o, out)

# ----------------------------------------------------------------- 6. origen, medidas y exportación
E = S["E"]
origin = np.array([0.0, (S["glab"] + S["back"]) / 2, E[2]])
LM = landmarks_lib.measure(V(skin), E)

all_objs = [skin, eyes["L"], eyes["R"]] + anat
for o in all_objs:
    set_V(o, V(o) - origin)

sv = V(skin)
lo, hi = sv.min(0), sv.max(0)
center_b = (lo + hi) / 2
radius = float(np.linalg.norm(sv - center_b, axis=1).max())


def to_gltf(p):  # Blender (Z arriba, cara -Y) → glTF (Y arriba, cara +Z)
    return [round(float(p[0]), 4), round(float(p[2]), 4), round(float(-p[1]), 4)]


meta = {
    "frame": {"target": to_gltf(center_b), "radius": round(radius * 0.92, 4)},
    "landmarks": {
        "top": round(LM["top"] - origin[2], 4),
        "browLine": round(LM["brow"] - origin[2], 4),
        "eyeLine": 0.0,
        "noseBase": round(LM["nose_base"] - origin[2], 4),
        "mouthLine": round(LM["mouth"] - origin[2], 4),
        "chin": round(LM["chin"] - origin[2], 4),
    },
    "fit": {"scale": [round(float(v), 4) for v in scale], "cut": {"z": round(float(ZC - origin[2]), 4), "x": round(float(XC), 4)}},
}
json.dump(meta, open(os.path.join(A.out, "meta.json"), "w"), indent=2)
log("meta", json.dumps(meta))

mats = {}
for name, color in (("skin", (0.85, 0.82, 0.78, 1)), ("muscle", (0.65, 0.3, 0.27, 1)), ("bone", (0.9, 0.87, 0.8, 1))):
    m = bpy.data.materials.new(name)
    m.diffuse_color = color
    mats[name] = m


def export(objs, mat, filename):
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for o in objs:
        o.data.name = o.name
        o.data.materials.clear()
        o.data.materials.append(mat)
        for vg in list(o.vertex_groups):
            o.vertex_groups.remove(vg)
        o.select_set(True)
    path = os.path.join(A.out, filename)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_apply=True,
        export_normals=True, export_texcoords=False, export_materials="EXPORT", export_skins=False,
        export_morph=False, export_animations=False,
    )
    log("exportado", path, sum(tri_count(o) for o in objs), "triángulos")


export([skin, eyes["L"], eyes["R"]], mats["skin"], "skin.glb")
export(layers_muscle := [o for o in anat if o.users_collection and o.users_collection[0].name == "muscle"], mats["muscle"], "muscle.glb")
export([o for o in anat if o.users_collection and o.users_collection[0].name == "skull"], mats["bone"], "skull.glb")
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(A.out, "assembled.blend"), compress=True)
log("listo")
