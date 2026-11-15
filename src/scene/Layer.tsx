import { useGLTF } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useAppStore } from '../state/store';
import { layerOpacity, layerVisible } from './layers';
import { isLayerInteractive, partMeshes } from './partLabels';

interface LayerProps {
  url: string;
  material: THREE.MeshStandardMaterial;
  /** Profundidad de la capa: 0 = piel, 1 = músculo, 2 = cráneo. */
  index: number;
}

/** Orden de dibujo del pre-pase de profundidad: después de todo lo opaco. */
const DEPTH_PREPASS_ORDER = 10;
const HIGHLIGHT = new THREE.Color('#ffb35c');

/**
 * Una capa del modelo (un GLB comprimido con Meshopt).
 *
 * Fundido limpio: mientras la capa está semitransparente se dibuja dos veces:
 *   1) un pre-pase que solo escribe profundidad (después de las capas opacas de adentro), y
 *   2) el color con transparencia, que solo pasa en la superficie más cercana.
 * Así no se ven las caras internas de la propia capa (músculos superpuestos,
 * cuello dentro de la cabeza, etc.), solo un "fantasma" limpio sobre la capa de abajo.
 *
 * En las capas interiores, cada mesh es una estructura con nombre: al pasar el cursor
 * o tocarla se resalta y se publica en el store para mostrar su etiqueta.
 */
export function Layer({ url, material, index }: LayerProps) {
  // draco = false, meshopt = true: el decodificador Meshopt viene con three (sin CDN).
  const gltf = useGLTF(url, false, true);
  const depthMaterial = useMemo(() => new THREE.MeshBasicMaterial({ colorWrite: false, side: material.side }), [material]);
  const highlightMaterial = useMemo(() => {
    const m = material.clone();
    m.emissive.copy(HIGHLIGHT);
    m.emissiveIntensity = 0.45;
    return m;
  }, [material]);

  const { root, depthRoot, meshes } = useMemo(() => {
    const root = gltf.scene.clone(true);
    const meshes: THREE.Mesh[] = [];
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.material = material;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      meshes.push(mesh);
    });
    const depthRoot = gltf.scene.clone(true);
    depthRoot.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.material = depthMaterial;
      mesh.renderOrder = DEPTH_PREPASS_ORDER;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.raycast = () => {}; // el pre-pase no debe capturar el puntero
    });
    depthRoot.visible = false;
    return { root, depthRoot, meshes };
  }, [gltf, material, depthMaterial, index]);

  // Registra las estructuras de las capas interiores (para la lista del panel).
  useEffect(() => {
    if (index === 0) return;
    const names = meshes.map((m) => m.name).filter(Boolean);
    for (const m of meshes) partMeshes.set(m.name, { mesh: m, layer: index });
    useAppStore.getState().setLayerParts(index, names);
    return () => {
      for (const m of meshes) if (partMeshes.get(m.name)?.mesh === m) partMeshes.delete(m.name);
      useAppStore.getState().setLayerParts(index, null);
    };
  }, [meshes, index]);

  useEffect(
    () => () => {
      depthMaterial.dispose();
      highlightMaterial.dispose();
    },
    [depthMaterial, highlightMaterial],
  );

  // La opacidad y el resaltado se aplican por frame leyendo el store, sin re-renderizar React.
  useFrame(() => {
    const { depth: d, hoveredPart, selectedPart } = useAppStore.getState();
    const opacity = layerOpacity(index, d);
    const visible = layerVisible(index, d);
    const fading = visible && opacity < 0.999;

    root.visible = visible;
    depthRoot.visible = fading;
    for (const m of [material, highlightMaterial]) {
      m.opacity = opacity;
      if (m.transparent !== fading) {
        m.transparent = fading;
        m.depthWrite = !fading;
        m.needsUpdate = true;
      }
    }

    const interactive = isLayerInteractive(index, d);
    const hovered = interactive && hoveredPart?.layer === index ? hoveredPart.name : null;
    const selected = interactive && selectedPart?.layer === index ? selectedPart.name : null;
    for (const m of meshes) {
      // Una capa que se desvanece no debe dejar en sombra a las de adentro.
      m.castShadow = !fading;
      m.material = m.name === hovered || m.name === selected ? highlightMaterial : material;
    }
  });

  // ---------------------------------------------------------------- puntero
  const handlers = useMemo(() => {
    if (index === 0) return {};
    const toRef = (e: ThreeEvent<PointerEvent | MouseEvent>) => ({
      name: e.object.name,
      layer: index,
      point: [e.point.x, e.point.y, e.point.z] as [number, number, number],
    });
    const active = () => isLayerInteractive(index, useAppStore.getState().depth);

    return {
      onPointerMove: (e: ThreeEvent<PointerEvent>) => {
        if (!active() || !e.object.name) return;
        e.stopPropagation();
        useAppStore.getState().setHoveredPart(toRef(e));
        document.body.style.cursor = 'pointer';
      },
      onPointerOut: (e: ThreeEvent<PointerEvent>) => {
        const { hoveredPart, setHoveredPart } = useAppStore.getState();
        if (hoveredPart?.name === e.object.name) {
          setHoveredPart(null);
          document.body.style.cursor = '';
        }
      },
      onClick: (e: ThreeEvent<MouseEvent>) => {
        // Si el usuario arrastró para orbitar, no es un clic.
        if (!active() || !e.object.name || e.delta > 6) return;
        e.stopPropagation();
        const { selectedPart, setSelectedPart } = useAppStore.getState();
        setSelectedPart(selectedPart?.name === e.object.name ? null : toRef(e));
      },
    };
  }, [index]);

  return (
    <>
      <primitive object={root} {...handlers} />
      <primitive object={depthRoot} />
    </>
  );
}
