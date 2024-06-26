import { MutableRefObject, Suspense, useLayoutEffect, useMemo, useRef } from 'react';
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Environment, OrbitControls } from '@react-three/drei';
import { Canvas, ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { useDrag } from '@use-gesture/react';
import { chunkSize, Voxels, VoxelsApi } from 'r3f-voxels';
import { Pathfinder } from 'r3f-voxels-pathfinder';
import { Color, MathUtils, Vector3 } from 'three';
import { atlas, ORMAtlas, getTexture } from './atlas';
import { CSM, useCSM } from './csm';
import { terrain } from './generator';
import { Actor, ActorApi } from './actor';
import { Clouds } from './clouds';
import { Dude } from './dude';
import { Postprocessing } from './postprocessing';

const aux = new Vector3();

const Scene = () => {
  const player = useRef<ActorApi>(null!);
  const npcs = useMemo<{
    key: string;
    color: Color;
    position: [number, number, number];
    sleep: number;
    speed: number;
    ref: MutableRefObject<ActorApi>,
  }[]>(() => Array.from({ length: 32 }, (_v, i) => ({
    key: `npc_${i}`,
    color: new Color().setHSL(Math.random(), 0.6, 0.6),
    position: [Math.sin(Math.PI * 2 / 32 * i) * 10, 16, Math.cos(Math.PI * 2 / 32 * i) * 10],
    sleep: 0,
    speed: 5 + Math.random() * 5,
    ref: { current: null! },
  })), []);
  const controls = useRef<OrbitControlsImpl>(null!);
  const voxels = useRef<VoxelsApi>(null!);
  const bind = useDrag<ThreeEvent<PointerEvent>>(({ event, distance, last }) => {
    if (last && Math.max(distance[0], distance[1]) < 5) {
      const remove = event.button === 1;
      const point = event.point.addScaledVector(event.face!.normal.transformDirection(event.object.matrixWorld), 0.5 * (remove ? -1 : 1)).floor();
      if (point.y > 0 && point.y < chunkSize * 2) {
        if (event.button === 0) {
          player.current.walk(point);
        } else {
          voxels.current.setVoxel(point, remove ? 0 : 2);
        }
      }
    }
  }, { pointer: { buttons: [1, 2, 4] }});

  useFrame((state, delta) => {
    delta = Math.min(delta, 0.2);
    const { position } = player.current.actor.current;
    const { target, object } = controls.current;
    const direction = aux.subVectors(object.position, target);
    const zoom = MathUtils.clamp(aux.length(), 3, 32);
    direction.normalize();
    target.x = MathUtils.damp(target.x, position.x, 1, delta);
    target.y = MathUtils.damp(target.y, position.y + 3.5, 1, delta);
    target.z = MathUtils.damp(target.z, position.z, 1, delta);
    object.position.copy(target).addScaledVector(direction, zoom);
    if (!player.current.isWalking()) {
      player.current.setTargetRotation(state.camera.position);
    }

    npcs.forEach((npc) => {
      if (npc.ref.current.isWalking() || (npc.sleep -= delta) > 0) {
        return;
      }
      npc.sleep = Math.random() * 16;
      const dest = npc.ref.current.actor.current.position.clone();
      dest.x += Math.random() * 32 - 16;
      dest.y = 16;
      dest.z += Math.random() * 32 - 16;
      dest.x = MathUtils.clamp(dest.x, -64, 64);
      dest.z = MathUtils.clamp(dest.z, -64, 64);
      npc.ref.current.walk(dest);
    });
  });

  const csm = useCSM();
  useLayoutEffect(() => {
    const material = voxels.current.getMaterial();
    material.defines.USE_OUTPUT_NORMAL = 1;
    return csm.setupMaterial(material);
  }, []);

  const clock = useThree(({ clock }) => clock);
  useLayoutEffect(() => {
    const onVisibilityChange = () => (
      document.visibilityState === 'visible' && clock.start()
    );
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  return (
    <>
      <Voxels
        atlas={atlas}
        occlusionRoughnessMetalnessAtlas={ORMAtlas}
        generator={terrain}
        getTexture={getTexture}
        followCamera
        {...(bind() as any)}
        ref={voxels}
      >
        <Suspense>
          <Pathfinder>
            <Actor position={[0, 16, 0]} speed={10} ref={player}>
              <Dude color={0xEE1111} />
            </Actor>
            {npcs.map(({ key, color, position, speed, ref }) => (
              <Actor key={key} position={position} speed={speed} ref={ref}>
                <Dude color={color} />
              </Actor>
            ))}
          </Pathfinder>
        </Suspense>
      </Voxels>
      <OrbitControls target={[0, 4, 0]} enablePan={false} ref={controls} />
    </>
  );
};

export const App = () => (
  <>
    <Canvas camera={{ position: [0, 16, 16] }} shadows>
      <CSM>
        <Scene />
      </CSM>
      <Clouds />
      <Environment blur={0.5} environmentIntensity={0.5} preset="sunset" />
      <Postprocessing />
    </Canvas>
  </>
);
