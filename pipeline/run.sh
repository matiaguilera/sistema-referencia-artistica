#!/usr/bin/env bash
# Pipeline completo: fuentes → GLB comprimidos en public/models/ + registro en models.json.
#
# Requisitos (ver pipeline/README.md):
#   - Blender 4.2+ con el addon MPFB2 instalado (variable BLENDER, PATH o instalación por defecto en Windows)
#   - pipeline/sources/Z-Anatomy.zip y pipeline/sources/TA2.csv
#   - npm install (para gltf-transform y meshoptimizer)
#
# Uso (desde la raíz del proyecto, en Git Bash / bash):
#   bash pipeline/run.sh            # todo
#   bash pipeline/run.sh female     # solo un modelo (male | female)
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -z "${BLENDER:-}" ]]; then
  if command -v blender >/dev/null 2>&1; then BLENDER=blender
  else BLENDER="$(ls -d "/c/Program Files/Blender Foundation"/Blender*/blender.exe 2>/dev/null | sort -V | tail -1)"; fi
fi
[[ -x "$BLENDER" || -n "$(command -v "$BLENDER" 2>/dev/null)" ]] || { echo "No se encontró Blender. Define BLENDER=/ruta/a/blender"; exit 1; }
echo "Blender: $BLENDER"

ROOT="$(pwd -W 2>/dev/null || pwd)"   # ruta nativa (Windows) para Blender
B="$ROOT/pipeline/build"
mkdir -p "$B"
run_blender() { "$BLENDER" -b --disable-autoexec "$@" 2>&1 | grep -E "^\[|OBJ |SAVED|EXTRACTED|WARN [a-z]|Error|Traceback" || true; }

MODELS=("${@:-male female}")
[[ $# -eq 0 ]] && MODELS=(male female)

# 1. Anatomía de Z-Anatomy (una vez)
if [[ ! -f "$B/anatomy.blend" || pipeline/config/parts.json -nt "$B/anatomy.blend" ]]; then
  if [[ ! -f "$B/zanatomy/Startup.blend" ]]; then
    mkdir -p "$B/zanatomy"
    unzip -o -j pipeline/sources/Z-Anatomy.zip "Z-Anatomy/Startup.blend" -d "$B/zanatomy" >/dev/null
  fi
  echo "== Extrayendo anatomía"
  run_blender "$B/zanatomy/Startup.blend" -P pipeline/scripts/extract_anatomy.py -- "$ROOT/pipeline/config/parts.json" "$B/anatomy.blend"
fi

# 2. Etiquetas (es / latín)
node pipeline/scripts/build_labels.mjs

for SEX in "${MODELS[@]}"; do
  echo "== $SEX: piel (MPFB2)"
  run_blender -P pipeline/scripts/build_skin.py -- "$SEX" "$B/skin_$SEX.blend"
  echo "== $SEX: ensamblado y ajuste (tarda unos minutos)"
  run_blender -P pipeline/scripts/assemble.py -- --skin "$B/skin_$SEX.blend" --anatomy "$B/anatomy.blend" --out "$B/$SEX"
  echo "== $SEX: compresión"
  node pipeline/scripts/optimize.mjs "pipeline/build/$SEX" "public/models/$SEX"
  if [[ "$SEX" == male ]]; then
    node pipeline/scripts/register_model.mjs male "pipeline/build/male/meta.json" "Masculino" male --default
  else
    node pipeline/scripts/register_model.mjs female "pipeline/build/female/meta.json" "Femenino" female
  fi
done
echo "Listo."
