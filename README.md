# Head Study

Referencia 3D de la cabeza humana para retratistas. La cabeza se puede ver desde cualquier ángulo, en tres capas (piel, músculo y cráneo) y con iluminación controlable.

**Stack:** Vite · React · TypeScript · three.js · @react-three/fiber · @react-three/drei · zustand
**Salida:** sitio estático. Funciona en Cloudflare Pages, Netlify o GitHub Pages.

## Uso rápido

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # genera dist/ (sitio estático)
npm run preview      # sirve dist/ para probar el build
npm run placeholders # genera modelos geométricos de prueba (no se registran en models.json)
bash pipeline/run.sh  # regenera los modelos reales (ver pipeline/README.md)
```

### Controles

| Acción | Mouse | Táctil | Teclado |
|---|---|---|---|
| Rotar | arrastrar | 1 dedo | |
| Zoom | rueda | pellizco | |
| Desplazar | clic derecho | 2 dedos | |
| Vistas predefinidas | panel → Cámara | panel | `1`–`8` |
| Restablecer vista | panel | panel | `0` |
| Piel / Músculo / Cráneo | panel → Capas | panel | `P` / `M` / `C` |
| Mover la luz principal | `Shift` + arrastrar | panel → Iluminación | |
| Modo valores | panel → Valores | panel | `V` |
| Nombre de una estructura | pasar el cursor | tocar | |
| Fijar / soltar la etiqueta | clic | tocar | `Esc` suelta |
| Mostrar / ocultar nombres | panel → Anatomía | panel | `N` |
| Guías de proporción | panel → Guías | panel | `G` |
| Guardar PNG | panel → Captura | panel | `S` |

El **slider de profundidad** pasa de forma continua de la piel al músculo y del músculo al hueso. La capa de afuera se vuelve transparente y deja ver la de abajo. En la vista muscular también se ve el cráneo entre los músculos.

### Anatomía

Las etiquetas se activan cuando el slider de profundidad está en *Músculo* o en *Cráneo*: al pasar el cursor, o al tocar en tablet, sobre una estructura, esta se resalta y aparece su nombre.

- **Selección:** con un clic la etiqueta queda fijada, así sigue visible mientras rotas la cabeza. Con `Esc` o con un clic en el fondo se suelta.
- **Nombres:** se muestran en español y opcionalmente en latín. El lado indica el lado **del modelo**: *izq.* es el izquierdo del modelo, que en vista frontal queda a la derecha de la pantalla.
- **Lista de estructuras:** el panel *Anatomía* lista todos los músculos y huesos. Al pasar por un nombre se resalta en el modelo, y con un clic se selecciona y la vista baja a esa capa si hace falta.

### Guías y captura

- **Guías de proporción** (`G`): curvas trazadas sobre la superficie de la piel en estas alturas:
  - vértice,
  - cejas,
  - ojos,
  - base de la nariz,
  - boca,
  - mentón.

  Siguen la forma de la cabeza, así que se leen igual de frente, en 3/4 o en perfil. La **línea media** (en celeste) se puede ocultar. Las alturas salen de `landmarks` en `models.json`; para los modelos incluidos, las mide el pipeline sobre el perfil de la cara.
- **Captura PNG** (`S`): guarda la vista actual a 1× o 2× de la resolución de pantalla.
  - Aparece tal como se ve, con el modo valores y las guías.
  - Se ocultan el indicador de la luz y las etiquetas.
  - El nombre del archivo indica modelo, vista, capa, modo valores y fecha.
- **Fondo:** oscuro, gris medio o claro.

### Iluminación

- **Luz principal:** es direccional, con sombras. Se ajusta con *Dirección* (azimut alrededor de la cabeza), *Altura* (elevación) e *Intensidad*.
  - El azimut usa la misma convención que la cámara: 0° es de frente y los valores positivos van hacia el lado izquierdo del modelo.
  - El punto amarillo indica de dónde viene la luz y se puede ocultar.
- **Presets:**
  - *Rembrandt:* 45° de lado, 40° arriba.
  - *Mariposa / Paramount:* frontal y alta.
  - *Split:* 90°.
  - *Borde:* contraluz a 150°.
  - *Desde abajo.*
- **Relleno:** es una luz suave sin sombras, del lado opuesto a la principal. Siempre está en el hemisferio frontal para aclarar la cara.
- **Ambiente:** controla qué tan oscuras quedan las sombras.
- **Modo valores:** pasa el render a escala de grises continua o lo posteriza en 3, 4 o 5 tonos. El control *Umbrales* desplaza los cortes entre tonos hacia lo claro o hacia lo oscuro.

## Estructura

```
public/models/
  models.json                ← registro de modelos (lo único que hay que editar para agregar uno)
  labels/anatomy.es.json     ← nombres de músculos y huesos (español / latín), generado desde TA2.csv
  <id-del-modelo>/skin.glb, muscle.glb, skull.glb
src/
  registry/   lectura y validación de models.json
  state/      estado global (zustand)
  scene/      lienzo 3D: cámara, capas, materiales, luces
  ui/         panel lateral y controles
scripts/make-placeholders.mjs  ← genera los modelos provisionales (solo para desarrollo)
pipeline/                      ← scripts de Blender y gltf-transform que generan los modelos reales
                                 (ver pipeline/README.md)
```

Los modelos incluidos son **Masculino** y **Femenino**:

- **Piel:** MPFB2 (CC0).
- **Músculos y cráneo:** Z-Anatomy (CC BY-SA 4.0), ajustados a cada cabeza.
- **Nombres:** en español y en latín, tomados de la Terminologia Anatomica (`TA2.csv` de Z-Anatomy).

Para regenerarlos, sigue [pipeline/README.md](pipeline/README.md).

## Cómo agregar un modelo nuevo

No hace falta tocar el código. Hay que preparar los archivos y registrarlos.

### 1. Prepara los GLB

Cada modelo necesita **un GLB por capa**. Solo la piel es obligatoria. Si falta una capa, la interfaz la oculta y el slider se ajusta.

| Capa | Archivo | Contenido |
|---|---|---|
| Piel | `skin.glb` | La superficie de cabeza y cuello. Puede ser uno o varios meshes. |
| Músculo | `muscle.glb` | **Un mesh por músculo**, nombrado con un id estable (ver abajo). |
| Cráneo | `skull.glb` | Un mesh por hueso: `cranium`, `mandible`, `cervical_vertebrae`… |

Las tres capas tienen que cumplir estas **convenciones de coordenadas**. Todas las capas comparten el mismo espacio, sin transformaciones distintas entre una y otra:

- Las unidades son **metros**, con **Y hacia arriba**, y la cara mira hacia **+Z**.
- El lado **izquierdo del modelo** está en **+X**.
- El origen está aproximadamente en el centro de la cabeza, a la altura de los ojos o de los tragus.

**Nombres de los meshes musculares.** Se usa el id del músculo en inglés o latín, en minúsculas y con guiones bajos, más `_L` o `_R` según el lado. Por ejemplo: `masseter_L`, `zygomaticus_major_R`, `orbicularis_oris` (los impares no llevan sufijo). El id sin sufijo tiene que existir en el JSON de etiquetas del modelo (por defecto `labels/anatomy.es.json`, que genera el pipeline) para que aparezca su nombre. Si el músculo es nuevo, agrégalo en `pipeline/scripts/build_labels.mjs` o en un JSON propio:

```json
"risorius": { "es": "Risorio", "la": "Musculus risorius" }
```

**Compresión.** Comprime los GLB con **Meshopt**, porque el visor no carga Draco para no depender de un CDN. Con [gltf-transform](https://gltf-transform.dev):

```bash
npx @gltf-transform/cli optimize entrada.glb salida.glb --compress meshopt --texture-compress false
```

Como referencia, conviene que cada capa pese menos de unos 3 MB y tenga menos de unos 300 mil triángulos en total.

### 2. Copia los archivos

```
public/models/mi-modelo/skin.glb
public/models/mi-modelo/muscle.glb
public/models/mi-modelo/skull.glb
```

### 3. Regístralo en `public/models/models.json`

Agrega una entrada al arreglo `models`:

```json
{
  "id": "female-60",
  "name": "Femenino, 60 años",
  "description": "Opcional: se muestra como nota en el panel.",
  "sex": "female",
  "age": 60,
  "layers": {
    "skin": "female-60/skin.glb",
    "muscle": "female-60/muscle.glb",
    "skull": "female-60/skull.glb"
  },
  "labels": "labels/anatomy.es.json",
  "frame": { "target": [0, -0.035, 0], "radius": 0.17 },
  "landmarks": { "top": 0.115, "browLine": 0.016, "eyeLine": 0.002, "noseBase": -0.057, "mouthLine": -0.075, "chin": -0.115 },
  "credits": ["Basado en MPFB2 (CC0) y Z-Anatomy (CC BY-SA 4.0)"]
}
```

| Campo | Obligatorio | Para qué sirve |
|---|---|---|
| `id` | sí | Identificador único, sin espacios. |
| `name` | sí | Nombre que aparece en el selector. |
| `layers.skin` | sí | Ruta relativa a `models.json`. |
| `layers.muscle`, `layers.skull` | no | Si faltan, esa capa no se ofrece. |
| `labels` | no | JSON con los nombres de los músculos. |
| `frame` | no | Punto al que mira la cámara (`target`) y radio aproximado de la cabeza con cuello en metros (`radius`). Se usa para el encuadre de las vistas predefinidas. |
| `landmarks` | no | Alturas Y (en metros) de las líneas de proporción para las guías: cejas, ojos, base de la nariz, boca y mentón. |
| `placeholder` | no | Si es `true`, el panel muestra un aviso de "modelo provisional". |
| `credits` | no | Atribución. **También hay que agregarla a `CREDITS.md`.** |

Para que un modelo aparezca seleccionado al abrir la app, pon su id en `defaultModel`.

### 4. Verifica

1. Corre `npm run dev`, elige el modelo nuevo y recorre las capas con el slider. Si la piel, los músculos y el cráneo **no coinciden**, el problema está en la alineación de los GLB, no en la app.
2. Si un modelo no aparece, abre la consola del navegador: el registro avisa si a una entrada le falta `id`, `name` o `layers.skin`, o si tiene un id repetido.

### 5. Licencia

Agrega la fuente y la licencia del modelo a [`CREDITS.md`](CREDITS.md). Solo se aceptan **CC0, CC BY o CC BY-SA**. Nada con cláusula NC (no comercial) ni ND (sin derivados).

## Solución de problemas

- **Pantalla negra o "Algo salió mal" con `npm run dev`:** a veces el servidor de Vite en Windows sigue sirviendo una versión vieja de un archivo que cambió varias veces seguidas. Detén el servidor (`Ctrl+C`), vuelve a correr `npm run dev` y recarga el navegador sin caché (`Ctrl+Shift+R`).
- **"La vista 3D se detuvo":** el navegador liberó la memoria gráfica, típicamente con una GPU integrada tras una captura grande o con muchas pestañas 3D abiertas. Recarga la página.

## Despliegue

`npm run build` genera `dist/`. Como el build usa rutas relativas (`base: './'`), funciona en la raíz de un dominio o en un subdirectorio:

- **Cloudflare Pages / Netlify:** comando de build `npm run build`, carpeta de salida `dist`.
- **GitHub Pages:** publica el contenido de `dist/`, por ejemplo con la acción `actions/deploy-pages`.
