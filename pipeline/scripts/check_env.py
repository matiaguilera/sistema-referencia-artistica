"""Comprueba que Blender ve el addon MPFB2. Uso: blender -b --factory-startup? (no: necesita prefs) -P check_env.py"""
import bpy, sys
print("BLENDER", bpy.app.version_string)
mods = [m for m in bpy.context.preferences.addons.keys()]
print("ADDONS", [m for m in mods if 'mpfb' in m.lower()])
print("HAS_MPFB_OPS", hasattr(bpy.ops, 'mpfb'))
try:
    from bl_ext.blender_org.mpfb.services.humanservice import HumanService  # noqa
    print("HUMANSERVICE OK")
except Exception as e:
    print("HUMANSERVICE ERR", e)
