"""Inventario del .blend de Z-Anatomy: objetos, tipo, colecciones, nº de vértices.
Uso: blender -b --disable-autoexec <Startup.blend> -P inventory_zanatomy.py -- <salida.json>
"""
import bpy, json, sys
out = sys.argv[sys.argv.index('--') + 1]

def coll_paths():
    paths = {}
    def walk(c, prefix):
        p = prefix + [c.name]
        for o in c.objects:
            paths.setdefault(o.name, []).append('/'.join(p))
        for ch in c.children:
            walk(ch, p)
    walk(bpy.context.scene.collection, [])
    return paths

paths = coll_paths()
rows = []
for o in bpy.data.objects:
    rows.append({
        'name': o.name,
        'type': o.type,
        'verts': len(o.data.vertices) if o.type == 'MESH' else 0,
        'colls': paths.get(o.name, []),
        'parent': o.parent.name if o.parent else None,
        'hide': o.hide_get() if o.name in bpy.context.view_layer.objects else None,
        'loc': [round(v, 4) for v in o.matrix_world.translation],
        'dims': [round(v, 4) for v in o.dimensions],
    })
json.dump({'scale_length': bpy.context.scene.unit_settings.scale_length, 'objects': rows}, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print('INVENTORY', len(rows))
