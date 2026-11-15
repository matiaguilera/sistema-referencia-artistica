import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Vec3 } from '../registry/types';
import { useAppStore } from '../state/store';
import { setLightManual } from './lightApi';
import { fillAzimuth, lightDirection } from './lightPresets';

const KEY_DISTANCE = 1.5;
const GIZMO_DISTANCE = 0.21;
const noRaycast = () => {};

/**
 * Iluminación de estudio:
 *  - luz principal direccional con sombras, orbitando la cabeza (azimut / elevación)
 *  - luz de relleno opcional, del lado opuesto y sin sombras
 *  - luz ambiente hemisférica, para controlar qué tan oscuras quedan las sombras
 * Los valores se leen del store en cada frame (sin re-render de React).
 */
export function Lighting({ target }: { target: Vec3 }) {
  const key = useRef<THREE.DirectionalLight>(null);
  const fill = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const gizmo = useRef<THREE.Group>(null);
  const targetObj = useMemo(() => new THREE.Object3D(), []);
  const t = useMemo(() => new THREE.Vector3(...target), [target]);

  useFrame(() => {
    const { light, showLightGizmo } = useAppStore.getState();
    const [dx, dy, dz] = lightDirection(light.azimuth, light.elevation);
    targetObj.position.copy(t);
    targetObj.updateMatrixWorld();

    if (key.current) {
      key.current.position.set(t.x + dx * KEY_DISTANCE, t.y + dy * KEY_DISTANCE, t.z + dz * KEY_DISTANCE);
      key.current.intensity = light.intensity;
    }
    if (fill.current) {
      const [fx, fy, fz] = lightDirection(fillAzimuth(light.azimuth), 10);
      fill.current.position.set(t.x + fx, t.y + fy, t.z + fz);
      fill.current.intensity = light.fillEnabled ? light.fillIntensity : 0;
      fill.current.visible = light.fillEnabled;
    }
    if (hemi.current) hemi.current.intensity = light.ambient;
    if (gizmo.current) {
      gizmo.current.visible = showLightGizmo;
      gizmo.current.position.set(t.x + dx * GIZMO_DISTANCE, t.y + dy * GIZMO_DISTANCE, t.z + dz * GIZMO_DISTANCE);
      gizmo.current.lookAt(t);
    }
  });

  return (
    <>
      <primitive object={targetObj} />
      <directionalLight
        ref={key}
        target={targetObj}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.006}
        shadow-camera-left={-0.3}
        shadow-camera-right={0.3}
        shadow-camera-top={0.3}
        shadow-camera-bottom={-0.3}
        shadow-camera-near={KEY_DISTANCE - 0.5}
        shadow-camera-far={KEY_DISTANCE + 0.5}
      />
      <directionalLight ref={fill} target={targetObj} color="#e8eeff" />
      <hemisphereLight ref={hemi} args={['#ffffff', '#55524c', 0.15]} />

      {/* Indicador de la dirección de la luz principal */}
      <group ref={gizmo} userData={{ hideInCapture: true }}>
        <mesh raycast={noRaycast}>
          <sphereGeometry args={[0.009, 16, 12]} />
          <meshBasicMaterial color="#ffd27a" toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, 0.02]} rotation={[Math.PI / 2, 0, 0]} raycast={noRaycast}>
          <coneGeometry args={[0.005, 0.016, 12]} />
          <meshBasicMaterial color="#ffd27a" toneMapped={false} />
        </mesh>
      </group>

      <LightDragHandler />
    </>
  );
}

/**
 * Shift + arrastrar sobre el lienzo mueve la luz principal en vez de la cámara.
 * (En tablet se usan los sliders del panel.)
 */
function LightDragHandler() {
  const gl = useThree((s) => s.gl);
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;

  useEffect(() => {
    const el = gl.domElement;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const down = (e: PointerEvent) => {
      if (!e.shiftKey || e.button !== 0) return;
      // Evita que CameraControls empiece a orbitar (este listener va en fase de captura).
      e.stopImmediatePropagation();
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      if (controls) controls.enabled = false;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* puntero ya liberado: se ignora */
      }
      el.style.cursor = 'crosshair';
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      const { azimuth, elevation } = useAppStore.getState().light;
      // Arrastrar a la derecha lleva la luz hacia la derecha de la pantalla (vista frontal).
      let az = azimuth + dx * 0.5;
      az = ((((az + 180) % 360) + 360) % 360) - 180;
      setLightManual({ azimuth: az, elevation: Math.max(-85, Math.min(85, elevation - dy * 0.5)) });
    };
    const up = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (controls) controls.enabled = true;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      el.style.cursor = '';
    };

    el.addEventListener('pointerdown', down, { capture: true });
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down, { capture: true });
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [gl, controls]);

  return null;
}
