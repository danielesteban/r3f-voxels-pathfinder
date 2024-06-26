import { MutableRefObject, memo, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Vector2,
  Vector3,
} from 'three';
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';

const getGeometry = () => {
  const depth = 4;
  const clouds = [];
  const aux = new Vector2();
  const center = new Vector2();
  const simplex = new SimplexNoise();
  for (let gx = -1; gx <= 1; gx++) {
    for (let gy = -1; gy <= 1; gy++) {
      if (Math.sqrt(gx ** 2 + gy ** 2) > 2.5) {
        continue;
      }
      const geometry = new BufferGeometry();
      const index: number[] = [];
      const position: number[] = [];
      const color: number[] = [];
      const width = 10 + Math.floor(Math.random() * 21);
      const height = 10 + Math.floor(Math.random() * 21);
      center.set(width * 0.5 - 0.5, height * 0.5 - 0.5);
      const radius = Math.min(center.x, center.y);
      const voxels = Array(width);
      for (let x = 0; x < width; x += 1) {
        voxels[x] = Array(height);
        for (let y = 0; y < height; y += 1) {
          const distance = aux.set(x, y).distanceTo(center);
          voxels[x][y] = (
            distance < radius
            && Math.abs(simplex.noise(x / 16, y / 16)) < distance * 0.05
          );
        }
      }
      let i = 0;
      const pushFace = (
        x1: number, y1: number, z1: number,
        x2: number, y2: number, z2: number,
        x3: number, y3: number, z3: number,
        x4: number, y4: number, z4: number,
        r: number, g: number, b: number
      ) => {
        position.push(
          x1 - center.x, y1, z1 - center.y,
          x2 - center.x, y2, z2 - center.y,
          x3 - center.x, y3, z3 - center.y,
          x4 - center.x, y4, z4 - center.y
        );
        color.push(
          r, g, b,
          r, g, b,
          r, g, b,
          r, g, b
        );
        index.push(
          i, i + 1, i + 2,
          i + 2, i + 3, i
        );
        i += 4;
      };
      for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
          if (voxels[x][y]) {
            pushFace(
              x, 0, y,
              x + 1, 0, y,
              x + 1, 0, y + 1,
              x, 0, y + 1,
              1, 1, 1
            );
            pushFace(
              x, depth, y + 1,
              x + 1, depth, y + 1,
              x + 1, depth, y,
              x, depth, y,
              1, 1, 1
            );
            if (x === 0 || !voxels[x - 1][y]) {
              pushFace(
                x, 0, y,
                x, 0, y + 1,
                x, depth, y + 1,
                x, depth, y,
                0.8, 0.8, 0.8
              );
            }
            if (x === (width - 1) || !voxels[x + 1][y]) {
              pushFace(
                x + 1, 0, y + 1,
                x + 1, 0, y,
                x + 1, depth, y,
                x + 1, depth, y + 1,
                0.8, 0.8, 0.8
              );
            }
            if (y === 0 || !voxels[x][y - 1]) {
              pushFace(
                x + 1, 0, y,
                x, 0, y,
                x, depth, y,
                x + 1, depth, y,
                0.8, 0.8, 0.8
              );
            }
            if (y === (height - 1) || !voxels[x][y + 1]) {
              pushFace(
                x, 0, y + 1,
                x + 1, 0, y + 1,
                x + 1, depth, y + 1,
                x, depth, y + 1,
                0.8, 0.8, 0.8
              );
            }
          }
        }
      }
      geometry.setIndex(new BufferAttribute(new Uint16Array(index), 1));
      geometry.setAttribute('position', new BufferAttribute(new Float32Array(position), 3));
      geometry.setAttribute('color', new BufferAttribute(new Float32Array(color), 3));
      clouds.push({
        geometry,
        origin: new Vector3(gx * 20, Math.random() * depth * 15, gy * 20),
      });
    }
  }
  return clouds;
};

export const Clouds = memo(() => {
  const group = useRef<Group>(null!);
  const clouds = useMemo<{
    key: string;
    geometry: BufferGeometry;
    origin: Vector3;
    speed: number;
    step: number;
    ref: MutableRefObject<Mesh>,
  }[]>(() => getGeometry().map(({ geometry, origin }, i) => ({
    key: `cloud_${i}`,
    geometry,
    origin,
    speed: (0.5 + Math.random() * 0.5) * 0.05,
    step: Math.random() * Math.PI * 2,
    ref: { current: null! },
  })), []);
  const cloudsMaterial = useMemo(() => new MeshBasicMaterial({ vertexColors: true }), []);
  useFrame((_state, delta) => {
    delta = Math.min(delta, 0.2);
    clouds.forEach((cloud) => {
      const { speed, origin, ref } = cloud;
      cloud.step += delta * speed;
      ref.current.position.set(
        origin.x + Math.sin(cloud.step) * 10,
        origin.y,
        origin.z + Math.cos(cloud.step) * 10
      );
    });
  });
  useLayoutEffect(() => {
    clouds.forEach((cloud) => {
      cloud.ref.current.layers.set(1);
    });
  }, []);
  return (
    <group position={[0, 128, 0]} scale={[16, 1, 16]} ref={group}>
      {clouds.map(({ key, geometry, origin, ref }) => (
        <mesh
          key={key}
          geometry={geometry}
          material={cloudsMaterial}
          position={origin}
          ref={ref}
        />
      ))}
    </group>
  )
});
