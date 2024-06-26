r3f-voxels-pathfinder
==

### Examples

* [Example](https://codesandbox.io/p/sandbox/r3f-voxels-pathfinder-jm3y5r)

### Installation 

```bash
npm install r3f-voxels-pathfinder
```

### Basic usage

```jsx
import { Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Voxels, VoxelsApi } from 'r3f-voxels';
import { Pathfinder, PathfinderApi } from 'r3f-voxels-pathfinder';
import { Vector3 } from 'three';

const Scene = () => {
  const voxels = useRef<VoxelsApi>(null!);
  const pathfinder = useRef<PathfinderApi>(null!);
  useLayoutEffect(() => {
    for (let i = 0; i < 16; i++) {
      voxels.current.setVoxel(new Vector3(i, 0, 0), 1);
    }
    console.log(
      pathfinder.current.getPath(
        new Vector3(0, 0, 0),
        new Vector3(10, 0, 0)
      )
    );
  }, []);
  return (
    <Voxels ref={voxels}>
      <Suspense>
        <Pathfinder ref={pathfinder} />
      </Suspense>
    </Voxels>
  );
};

const App = () =>  (
  <Canvas>
    <Scene />
    <ambientLight />
  </Canvas>
);
```

### Api

```ts
type PathfinderApi = {
  addObstacle: (position: Vector3) => void;
  removeObstacle: (position: Vector3) => void;
  getPath: (from: Vector3, to: Vector3, height?: number) => Vector3[];
  ground: (position: Vector3, height?: number, minY?: number) => boolean;
};
```
