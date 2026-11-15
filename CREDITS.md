# Créditos y licencias

## Código

El código de la aplicación (carpetas `src/`, `scripts/` y `pipeline/`) es propio del proyecto.
Sus dependencias (three.js, React, @react-three/fiber, @react-three/drei, zustand, gltf-transform y meshoptimizer) se distribuyen con licencia MIT.

## Modelos 3D

### `public/models/male/` y `public/models/female/`

Se generan con el pipeline de `pipeline/` (ver `pipeline/README.md`).

| Capa | Fuente | Licencia |
|---|---|---|
| `skin.glb`: piel y ojos | **MakeHuman / MPFB2** v2.0.18: malla base `hm08` y targets macro del sistema. No se usan assets de terceros. | **CC0 1.0** |
| `muscle.glb`: músculos y globos oculares | **Z-Anatomy**, *Models-of-human-anatomy* (`Z-Anatomy.zip`, `Startup.blend`) | **CC BY-SA 4.0** |
| `skull.glb`: huesos, dientes, cartílagos y vértebras | **Z-Anatomy** (ídem) | **CC BY-SA 4.0** |
| `labels/anatomy.es.json`: nombres en español y latín | **Z-Anatomy**, `TA2.csv` (traducción de la Terminologia Anatomica) | **CC BY-SA 4.0** |

**Atribuciones**, con el texto que pide Z-Anatomy en su README:

- BodyParts3D - The Database Center for Life Science - CC-BY-SA 2.1 Japan
  (https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html)
- Z-Anatomy - The libre 3D atlas of anatomy - CC-BY-SA 4.0
  (https://github.com/Z-Anatomy/Models-of-human-anatomy)

> Nota: el README actual de BodyParts3D declara CC BY 4.0 desde el 27/02/2025. Se mantiene la atribución que pide Z-Anatomy porque es más exigente (BY-SA).

**Modificaciones realizadas** (lo exige CC BY-SA):
- Se extrajeron solo las estructuras de cabeza y cuello, según la lista de `pipeline/config/parts.json`.
- Se unieron porciones de una misma estructura en un solo mesh.
- Se redujeron polígonos y se reorientaron las normales.
- Se escalaron y deformaron (de forma no rígida) para calzar en las pieles de MPFB2.
- Se recortaron en la base del cuello.
- El modelo **femenino** es la anatomía **masculina** de Z-Anatomy adaptada a una piel femenina. No es anatomía femenina medida.

**Consecuencia de share-alike:** los archivos `muscle.glb`, `skull.glb` y `labels/anatomy.es.json` se distribuyen bajo **CC BY-SA 4.0**. Esa obligación aplica a esos archivos, no al código del visor.

**Exclusiones:** el README de Z-Anatomy declara que dos modelos incluidos tienen licencia no comercial: el oído interno (CC BY-NC-SA 4.0, University of Dundee) y el riñón (CC BY-NC 4.0). **Ninguno** se usa: la lista blanca no los incluye y el pipeline descarta todo lo que no figure en ella.

### Modelos provisionales (`scripts/make-placeholders.mjs`)

Son formas geométricas generadas por código, sin derivar de ningún modelo externo. **Licencia: CC0 1.0.** Ya no aparecen en la app; el script queda para desarrollo.
