import { forwardRef, memo, MutableRefObject, PropsWithChildren, useCallback, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, MathUtils, Object3DEventMap, Vector3 } from 'three';
import { usePathfinder } from 'r3f-voxels-pathfinder';

export type ActorApi = {
  actor: MutableRefObject<Group<Object3DEventMap>>,
  isWalking: () => boolean;
  setTargetRotation: (target: Vector3) => void;
  walk: (point: Vector3) => void;
};

export type ActorProps = {
  position: [number, number, number],
  speed: number,
} & PropsWithChildren;

const auxA = new Vector3();
const auxB = new Vector3();

export const Actor = memo(forwardRef<ActorApi, ActorProps>(({
  children,
  position,
  speed,
}, ref) => {
  const actor = useRef<Group>(null!);
  const pathfinder = usePathfinder();
  const walking = useRef<{ animation: number; step: number; path: Vector3[] } | null>(null);
  const setTargetRotation = useCallback((target: Vector3) => {
    const { position, rotation } = actor.current;
    auxA.copy(position).floor();
    auxA.x += 0.5;
    auxA.z += 0.5;
    if (auxA.x === target.x && auxA.z === target.z) {
      return;
    }
    auxB.subVectors(target, auxA);
    auxB.y = 0;
    auxB.normalize();
    const targetRotation = actor.current.userData.targetRotation = Math.atan2(auxB.x, auxB.z);
    const d = Math.abs(targetRotation - rotation.y);
    if (Math.abs(targetRotation - (rotation.y - Math.PI * 2)) < d) {
      rotation.y -= Math.PI * 2;
    } else if (Math.abs(targetRotation - (rotation.y + Math.PI * 2)) < d) {
      rotation.y += Math.PI * 2;
    }
  }, []);
  useImperativeHandle(ref, () => ({
    actor,
    isWalking: () => !!walking.current,
    setTargetRotation,
    walk: (point: Vector3) => {
      if (pathfinder.ground(point)) {
        pathfinder.removeObstacle(
          walking.current ? walking.current.path[walking.current.path.length - 1] : actor.current.position
        );
        const path = pathfinder.getPath(actor.current.position, point, 3);
        if (path.length) {
          walking.current = {
            animation: 0,
            step: 1,
            path: [
              actor.current.position.clone(),
              ...path,
            ],
          };
          setTargetRotation(path[0]);
        }
        pathfinder.addObstacle(
          walking.current ? walking.current.path[walking.current.path.length - 1] : actor.current.position
        );
      }
    }
  }), [actor.current]);
  useFrame((_state, delta) => {
    delta = Math.min(delta, 0.2);
    const { position, rotation } = actor.current;
    if (walking.current) {
      walking.current.animation += delta * speed;
      if (walking.current.animation > 1) {
        walking.current.animation -= 1;
        walking.current.step++;
        if (walking.current.step >= walking.current.path.length) {
          position.copy(walking.current.path[walking.current.step - 1]);
          walking.current = null;
          return;
        }
        setTargetRotation(walking.current.path[walking.current.step]);
      }
      position.lerpVectors(
        walking.current.path[walking.current.step - 1],
        walking.current.path[walking.current.step],
        walking.current.animation
      );
    }
    const { userData: { targetRotation } } = actor.current;
    if (Math.abs(targetRotation - rotation.y) > 0.01) {
      rotation.y = MathUtils.damp(rotation.y, targetRotation, speed, delta);
    }
  });
  useLayoutEffect(() => {
    pathfinder.ground(actor.current.position.fromArray(position));
    actor.current.position.x += 0.5;
    actor.current.position.z += 0.5;
    actor.current.rotation.set(0, 0, 0, 'YXZ');
    actor.current.userData.targetRotation = 0;
    pathfinder.addObstacle(actor.current.position);
    return () => {
      pathfinder.removeObstacle(
        walking.current ? walking.current.path[walking.current.path.length - 1] : actor.current.position
      );
    }
  }, [position[0], position[1], position[2]]);
  return (
    <group ref={actor}>
      {children}
    </group>
  );
}));
