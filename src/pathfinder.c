#include <stdbool.h>
#include "./AStar.c"

void addResult(const int x, const int y, const int z);
bool canWalkAt(const int x, const int y, const int z);

typedef struct {
  int x;
  int y;
  int z;
} Voxel;

static const int maxVisited = 4096;
static const int horizontalNeighbors[] = {
  -1, 0,
  1, 0,
  0, -1,
  0, 1
};
static const int verticalNeighbors[] = {
  0,
  1,
  -1
};

static void PathNodeNeighbors(ASNeighborList neighbors, void* pathNode, void* context) {
  Voxel* node = (Voxel*) pathNode;
  for (int i = 0; i < 8; i += 2) {
    const int x = horizontalNeighbors[i];
    const int z = horizontalNeighbors[i + 1];
    for (int j = 0; j < 3; j++) {
      const int y = verticalNeighbors[j];
      if (canWalkAt(node->x + x, node->y + y, node->z + z)) {
        ASNeighborListAdd(neighbors, &(Voxel){node->x + x, node->y + y, node->z + z}, j > 0 ? 1.25 : 1);
      }
    }
  }
}

static float PathNodeHeuristic(void* fromNode, void* toNode, void* context) {
  Voxel* from = (Voxel*) fromNode;
  Voxel* to = (Voxel*) toNode;
  return abs(from->x - to->x) + abs(from->y - to->y) + abs(from->z - to->z);
}

static int EarlyExit(size_t visitedCount, void* visitingNode, void* goalNode, void* context) {
  if (visitedCount > maxVisited) {
    return -1;
  }
  return 0;
}

static const ASPathNodeSource PathNodeSource = {
  sizeof(Voxel),
  &PathNodeNeighbors,
  &PathNodeHeuristic,
  &EarlyExit,
  NULL
};

void pathfind(
  const int fromX,
  const int fromY,
  const int fromZ,
  const int toX,
  const int toY,
  const int toZ
) {
  ASPath path = ASPathCreate(
    &PathNodeSource,
    NULL,
    &(Voxel){fromX, fromY, fromZ},
    &(Voxel){toX, toY, toZ}
  );
  const int nodes = ASPathGetCount(path);
  for (int i = 0; i < nodes; i++) {
    Voxel* node = ASPathGetNode(path, i);
    addResult(node->x, node->y, node->z);
  }
  ASPathDestroy(path);
}
