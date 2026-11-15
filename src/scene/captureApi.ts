import type { RootState } from '@react-three/fiber';
import type * as THREE from 'three';

/**
 * Captura PNG de la vista actual.
 *
 * Se renderiza un frame a mayor resolución (si se pide) y se lee el lienzo en el mismo
 * tick, así no hace falta `preserveDrawingBuffer` (que penaliza el rendimiento siempre).
 * Los objetos con `userData.hideInCapture` (el indicador de la luz) se ocultan.
 * Las etiquetas HTML (nombres) no forman parte del lienzo, así que no salen en la imagen.
 */
let getState: (() => RootState) | null = null;
/** Si el modo valores está activo, renderiza con su compositor. */
let customRenderer: { render: () => void; setPixelRatio: (dpr: number) => void } | null = null;

export function registerCaptureState(get: (() => RootState) | null) {
  getState = get;
}

export function registerCustomRenderer(r: typeof customRenderer) {
  customRenderer = r;
}

export async function captureView(scale: 1 | 2, filename: string) {
  if (!getState) throw new Error('El visor todavía no está listo');
  const state = getState();
  const { gl, scene, camera, size } = state;
  const prevDpr = gl.getPixelRatio();
  // Tope de tamaño: una imagen demasiado grande puede agotar la memoria de la GPU y el
  // navegador quita el contexto WebGL (la vista queda en negro). 4096 px en el lado mayor
  // alcanza de sobra para una referencia y funciona en GPUs integradas.
  const MAX_SIDE = Math.min(4096, gl.capabilities.maxTextureSize);
  const wanted = Math.max(1, window.devicePixelRatio || 1) * scale;
  const dpr = Math.min(wanted, MAX_SIDE / Math.max(size.width, size.height));

  const hidden: THREE.Object3D[] = [];
  scene.traverse((o) => {
    if (o.userData.hideInCapture && o.visible) {
      o.visible = false;
      hidden.push(o);
    }
  });

  let blob: Blob | null = null;
  try {
    gl.setPixelRatio(dpr);
    gl.setSize(size.width, size.height, false);
    customRenderer?.setPixelRatio(dpr);
    if (customRenderer) customRenderer.render();
    else gl.render(scene, camera);
    // toBlob toma la imagen del lienzo en el momento de la llamada.
    blob = await new Promise<Blob | null>((resolve) => gl.domElement.toBlob(resolve, 'image/png'));
  } finally {
    for (const o of hidden) o.visible = true;
    gl.setPixelRatio(prevDpr);
    gl.setSize(size.width, size.height, false);
    customRenderer?.setPixelRatio(prevDpr);
  }
  if (!blob) throw new Error('El navegador no pudo generar la imagen');

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
