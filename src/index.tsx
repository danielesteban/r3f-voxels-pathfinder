import React from 'react';
import { VoxelsApi, useVoxels } from 'r3f-voxels';
import { suspend } from 'suspend-react';
import { Vector3 } from 'three';
import PathfinderProgram from './pathfinder.wasm';

const auxA = new Vector3();
const auxB = new Vector3();

class PathfinderInstance {
  private height: number = 0;
  private instance: WebAssembly.Instance = undefined as unknown as WebAssembly.Instance;
  private obstacles: Set<string> = undefined as unknown as Set<string>;
  private results: Vector3[] = [];
  private voxels: VoxelsApi = undefined as unknown as VoxelsApi;

  async init() {
    this.instance = (await PathfinderProgram({
      env: {
        addResult: this.addResult.bind(this),
        canWalkAt: this.canWalkAt.bind(this),
      },
    })).instance;
  }

  getPath(from: Vector3, to: Vector3, height: number, obstacles: Set<string>, voxels: VoxelsApi) {
    const { instance } = this;
    this.height = height;
    this.obstacles = obstacles;
    this.results = [];
    this.voxels = voxels;
    auxA.copy(from).floor();
    auxB.copy(to).floor();
    (instance as any).exports.pathfind(
      auxA.x, auxA.y, auxA.z,
      auxB.x, auxB.y, auxB.z
    );
    return this.results.slice(1);
  }

  ground(position: Vector3, height: number, minY: number, obstacles: Set<string>, voxels: VoxelsApi) {
    this.height = height;
    this.obstacles = obstacles;
    this.voxels = voxels;
    position.floor();
    for (; position.y >= minY; position.y--) {
      if (this.canWalkAt(position.x, position.y, position.z)) {
        return true;
      }
    }
    return false;
  }

  private addResult(x: number, y: number, z: number) {
    const { results } = this;
    const { length } = results;
    x += 0.5;
    z += 0.5;
    if (length > 0) {
      const last = results[length - 1];
      if (y < last.y) {
        results.push(new Vector3(x, last.y, z));
      } else if (y > last.y) {
        results.push(new Vector3(last.x, y, last.z));
      }
    }
    results.push(new Vector3(x, y, z));
  }

  private canWalkAt(x: number, y: number, z: number) {
    const { height, obstacles, voxels } = this;
    if (voxels.getVoxel(auxA.set(x, y, z)) === 0 || obstacles.has(`${x}:${y}:${z}`)) {
      return false;
    }
    for (let i = 1; i <= height; i++) {
      if (voxels.getVoxel(auxA.set(x, y + i, z)) !== 0) {
        return false;
      }
    }
    return true;
  }
}

const getPathFinderInstance = async () => {
  const instance = new PathfinderInstance();
  await instance.init();
  return instance;
};

export type PathfinderApi = {
  addObstacle: (position: Vector3) => void;
  removeObstacle: (position: Vector3) => void;
  getPath: (from: Vector3, to: Vector3, height?: number) => Vector3[];
  ground: (position: Vector3, height?: number, minY?: number) => boolean;
};

const PathfinderContext = React.createContext<PathfinderApi | null>(null);

export const Pathfinder = React.memo(React.forwardRef<PathfinderApi, React.PropsWithChildren>(({
  children,
}, ref) => {
  const pathfinder = suspend(getPathFinderInstance, ['r3f-voxels-pathfinder', getPathFinderInstance]);
  const obstacles = React.useRef<Set<string>>(null!);
  if (!obstacles.current) {
    obstacles.current = new Set();
  }
  const voxels = useVoxels();
  const api = React.useMemo<PathfinderApi>(() => ({
    addObstacle: (position: Vector3) => {
      auxA.copy(position).floor();
      obstacles.current.add(`${auxA.x}:${auxA.y}:${auxA.z}`);
    },
    removeObstacle: (position: Vector3) => {
      auxA.copy(position).floor();
      obstacles.current.delete(`${auxA.x}:${auxA.y}:${auxA.z}`);
    },
    getPath: (from: Vector3, to: Vector3, height: number = 0) => pathfinder.getPath(from, to, height, obstacles.current, voxels),
    ground: (position: Vector3, height: number = 0, minY: number = 0) => pathfinder.ground(position, height, minY, obstacles.current, voxels),
  }), []);
  React.useImperativeHandle(ref, () => api, [api]);
  return (
    <PathfinderContext.Provider value={api}>
      {children}
    </PathfinderContext.Provider>
  );
}));

export const usePathfinder = () => {
  const api = React.useContext(PathfinderContext);
  if (!api) {
    throw new Error(
      'r3f-voxels-pathfinder: usePathfinder must be used within <Pathfinder />!',
    );
  }
  return api;
};
