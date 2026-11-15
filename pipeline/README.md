# Pipeline de modelos

Convierte las fuentes abiertas en los GLB que usa la app: `public/models/<id>/{skin,muscle,skull}.glb`.

```
MPFB2 (CC0) ──────────────► piel genérica (cuerpo entero, sin pelo ni ropa)
                                         │
Z-Anatomy (CC BY-SA 4.0) ─► músculos + huesos (lista blanca) ─► ajuste a la piel ─► recorte ─► GLB ─► Meshopt
TA2.csv (Z-Anatomy) ──────► nombres en español y latín
```

## Requisitos

| Qué | Dónde |
|---|---|
| Blender 4.2 o posterior (probado con 5.3) | en el `PATH`, en la variable `BLENDER` o en la carpeta de instalación por defecto de Windows |
| Addon **MPFB2** instalado en ese Blender | *Edit → Preferences → Get Extensions → "MPFB"* |
| `pipeline/sources/Z-Anatomy.zip` | [Z-Anatomy/Models-of-human-anatomy](https://github.com/Z-Anatomy/Models-of-human-anatomy) (no hay que descomprimirlo) |
| `pipeline/sources/TA2.csv` | el mismo repositorio |
| Dependencias de Node | `npm install` en la raíz |

`pipeline/sources/` y `pipeline/build/` están en `.gitignore`.

## Ejecutar

Desde la raíz del proyecto, en Git Bash o en cualquier bash:

```bash
bash pipeline/run.sh          # los dos modelos
bash pipeline/run.sh female   # solo uno
```

Cada modelo tarda entre 4 y 5 minutos; casi todo el tiempo se va en el ajuste fino.

## Scripts

| Script | Qué hace |
|---|---|
| `scripts/extract_anatomy.py` | Abre el `.blend` de Z-Anatomy **sin ejecutar sus scripts** (`--disable-autoexec`). Copia solo los objetos de `config/parts.json`, con las transformaciones aplicadas, y une las partes de una misma estructura (por ejemplo, las porciones superficial y profunda del masetero). |
| `scripts/build_skin.py` | Crea la piel con MPFB2: 25 años, proporciones, peso y musculatura medios, mezcla étnica equilibrada. Solo cambia el género. Guarda la piel y las esferas de los ojos. |
| `scripts/assemble.py` | Ajusta la anatomía a la piel, recorta cabeza y cuello y exporta los tres GLB más `meta.json` (encuadre y líneas de proporción). |
| `scripts/optimize.mjs` | Comprime con Meshopt y cuantiza, usando gltf-transform. |
| `scripts/build_labels.mjs` | Genera `public/models/labels/anatomy.es.json` a partir de `TA2.csv`. |
| `scripts/register_model.mjs` | Agrega el modelo a `public/models/models.json`, o lo actualiza si ya está. |
| `scripts/inventory_zanatomy.py` | Lista todos los objetos de Z-Anatomy en un JSON. Sirve para buscar nombres al editar `parts.json`. |

## Cómo se alinean las capas

1. **Ajuste global.** Se calcula una escala por eje y una traslación que hacen coincidir referencias de la anatomía con las de la piel:
   - **Referencias:** centro de los ojos, vértice del cráneo, mentón, glabela, occipucio y ancho del cráneo sobre las orejas.
   - **Tejido blando:** en la anatomía, a cada referencia se le suma un grosor típico (de 4 a 7 mm).
2. **Recorte.** El corte inferior pasa 2 cm por debajo del borde superior del manubrio, de modo que se ven la escotadura yugular y las clavículas. Dos planos laterales cortan a unos 9 cm del centro. La piel recibe tapas en esos cortes.
3. **Ajuste fino no rígido**, en tres iteraciones:
   - Desde unas 3.500 muestras de la piel se lanza un rayo hacia adentro.
   - Si el primer tejido anatómico queda más hondo que el grosor esperado (4 mm; 5 mm en cuero cabelludo y cuello; 6 mm en los labios), se acerca. Si atraviesa la piel, se mete.
   - Cada corrección se limita a 1 cm y se reparte a toda la anatomía con un núcleo gaussiano de 1,2 cm. Así las estructuras profundas casi no se mueven.
   - Las orejas no participan en el ajuste.

### Precisión

- **Modelo masculino:** la anatomía es la de BodyParts3D, deformada para calzar en la cabeza de MPFB. La relación entre músculo, hueso y superficie es fiel en la forma general. Pueden quedar diferencias de algunos milímetros en zonas de tejido grueso, como las mejillas o la papada.
- **Modelo femenino:** **no existe una anatomía femenina abierta** de esta calidad, así que se usa la masculina, adaptada con el mismo procedimiento a la piel femenina de MPFB.
  - **Bien resueltas:** las proporciones globales (tamaño del cráneo, ancho de la cara, relación entre cara y cráneo) y que nada atraviese la piel.
  - **No reproducidas:** las diferencias óseas propias del dimorfismo sexual: arco superciliar más suave, mastoides más pequeña, ángulo mandibular más abierto y mentón más estrecho. El cráneo femenino es, en esencia, un cráneo masculino adaptado.
  - **Uso recomendado:** sirve para estudiar planos, masas y la relación entre capas. No sirve como referencia forense de un cráneo femenino.

## Agregar o quitar estructuras

Edita `config/parts.json`:

- `{s}` se convierte en `l` y `r`, y genera dos estructuras: `<id>_L` y `<id>_R`.
- Los nombres de Z-Anatomy se buscan en el inventario:
  ```bash
  blender -b --disable-autoexec pipeline/build/zanatomy/Startup.blend -P pipeline/scripts/inventory_zanatomy.py -- pipeline/build/zanatomy/inventory.json
  ```
- Cada estructura nueva necesita su nombre en `build_labels.mjs`, salvo que el nombre inglés de Z-Anatomy ya coincida con `TA2.csv`.

**No hay que incluir** el oído interno (CC BY-NC-SA) ni el riñón (CC BY-NC), porque no tienen una licencia libre para uso comercial.

### Estructuras que faltan en Z-Anatomy

- **Buccinador:** Z-Anatomy no tiene su malla, así que en los modelos reales no aparece.
- **Músculos auriculares:** tampoco tienen malla.
- **Platisma:** existe, pero lo dejé fuera porque tapa casi todo el cuello. Para incluirlo, agrega `"platysma_{S}": ["Platysma.{s}"]`.
