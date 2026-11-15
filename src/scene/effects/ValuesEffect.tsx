import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { useAppStore } from '../../state/store';
import { registerCustomRenderer } from '../captureApi';

/**
 * Modo "valores": convierte el render a escala de grises y, opcionalmente,
 * lo posteriza en N tonos (como un estudio de notan / valores).
 * Se aplica después de OutputPass, sobre los valores ya en sRGB (lo que ve el ojo).
 */
const PosterizeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    levels: { value: 3 },
    bias: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float levels;
    uniform float bias;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = clamp(dot(c, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
      l = pow(l, bias);
      if (levels >= 2.0) {
        float idx = min(floor(l * levels), levels - 1.0);
        // Tonos repartidos entre casi negro y casi blanco (como un juego de grises de pintor).
        l = mix(0.07, 0.95, idx / (levels - 1.0));
      }
      gl_FragColor = vec4(vec3(l), 1.0);
    }
  `,
};

export function ValuesEffect() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);

  const { composer, posterize } = useMemo(() => {
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    const composer = new EffectComposer(gl, rt);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new OutputPass());
    const posterize = new ShaderPass(PosterizeShader);
    composer.addPass(posterize);
    return { composer, posterize };
  }, [gl, scene, camera]);

  useEffect(() => {
    composer.setPixelRatio(dpr);
    composer.setSize(size.width, size.height);
  }, [composer, size, dpr]);

  useEffect(() => () => composer.dispose(), [composer]);

  // La captura PNG usa el compositor mientras el modo valores está activo.
  useEffect(() => {
    registerCustomRenderer({
      render: () => composer.render(),
      setPixelRatio: (r) => {
        composer.setPixelRatio(r);
        composer.setSize(size.width, size.height);
      },
    });
    return () => registerCustomRenderer(null);
  }, [composer, size]);

  // Prioridad 1: este useFrame toma el control del render (r3f deja de renderizar solo).
  useFrame(() => {
    const { valueLevels, valueBias } = useAppStore.getState();
    posterize.uniforms.levels.value = valueLevels;
    posterize.uniforms.bias.value = valueBias;
    composer.render();
  }, 1);

  return null;
}
