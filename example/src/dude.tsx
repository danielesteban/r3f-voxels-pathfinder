import { memo, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture, ColorRepresentation, MeshStandardMaterial, NearestFilter, SRGBColorSpace } from 'three';
import { useCSM } from './csm';

type DudeProps = {
  color: ColorRepresentation;
};

export const FaceTexture = (() => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = 32;
  canvas.height = 32 * 2;

  for (let i = 0; i < 2; i++) {
    ctx.save();
    ctx.translate(0, 32 * i);
    ctx.fillStyle = '#fff';
    [8, 24].forEach((x) => {
      ctx.save();
      ctx.translate(x, 9);
      ctx.scale(1, i === 1 ? 0.25 : 1);
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.translate(16, 19);
    ctx.scale(1, 0.8);
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI);
    ctx.stroke();
    ctx.restore();
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = texture.magFilter = NearestFilter;
  texture.repeat.set(1, 1 / 2);
  return () => texture.clone();
})();

export const Dude = memo(({ color }: DudeProps) => {
  const csm = useCSM();
  const material = useMemo(() => new MeshStandardMaterial({ color, defines: { USE_OUTPUT_NORMAL: 1 } }), []);
  useLayoutEffect(() => csm.setupMaterial(material), []);
  const faceMaterial = useMemo(() => new MeshStandardMaterial({ color, map: FaceTexture(), defines: { USE_OUTPUT_NORMAL: 1 } }), []);
  useLayoutEffect(() => csm.setupMaterial(faceMaterial), []);
  const faceAnimation = useRef<{ step: number; timer: number }>(null!);
  if (!faceAnimation.current) {
    faceAnimation.current = { step: 0, timer: Math.random() };
  }
  useFrame((_state, delta) => {
    delta = Math.min(delta, 0.2);
    const { current: animation } = faceAnimation;
    if ((animation.timer -= delta) > 0) {
      return;
    }
    animation.step = (animation.step + 1) % 2;
    animation.timer += 0.1 + Math.random() * 0.9;
    faceMaterial.map!.offset.set(0, animation.step / 2);
  });
  return (
    <>
      <mesh position={[0, 2.0625, 0]} material={material} castShadow receiveShadow>
        <capsuleGeometry args={[0.5, 1.125]} />
      </mesh>
      <mesh position={[0, 3.5, 0]} material={[material, material, material, material, faceMaterial, material]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
    </>
  );
});
