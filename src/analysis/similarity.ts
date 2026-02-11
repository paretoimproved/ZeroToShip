/**
 * Similarity and Clustering Utilities for ZeroToShip
 *
 * Implements cosine similarity calculations and similarity matrix operations
 * for clustering similar posts together.
 */

/** Default similarity threshold for clustering related posts */
export const DEFAULT_SIMILARITY_THRESHOLD = 0.75;

/** Default minimum points for DBSCAN core point classification */
export const DEFAULT_DBSCAN_MIN_POINTS = 1;

/**
 * Compute cosine similarity between two vectors
 * Returns a value between -1 and 1 (1 = identical, 0 = orthogonal, -1 = opposite)
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error(`Vector dimension mismatch: ${vecA.length} vs ${vecB.length}`);
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Compute pairwise cosine similarity matrix
 * Returns an NxN matrix where result[i][j] = similarity(vectors[i], vectors[j])
 */
export function computeSimilarityMatrix(vectors: number[][]): number[][] {
  const n = vectors.length;
  const matrix: number[][] = new Array(n);

  // Initialize all rows upfront so we can set symmetric values
  for (let i = 0; i < n; i++) {
    matrix[i] = new Array(n);
    matrix[i][i] = 1.0; // Self-similarity is always 1
  }

  // Compute pairwise similarities
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = cosineSimilarity(vectors[i], vectors[j]);
      matrix[i][j] = sim;
      matrix[j][i] = sim; // Matrix is symmetric
    }
  }

  return matrix;
}

/**
 * Find all pairs above a similarity threshold
 * Returns array of [indexA, indexB, similarity] tuples
 */
export function findSimilarPairs(
  vectors: number[][],
  threshold: number
): Array<[number, number, number]> {
  const pairs: Array<[number, number, number]> = [];
  const n = vectors.length;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = cosineSimilarity(vectors[i], vectors[j]);
      if (sim >= threshold) {
        pairs.push([i, j, sim]);
      }
    }
  }

  // Sort by similarity descending
  return pairs.sort((a, b) => b[2] - a[2]);
}

/**
 * DBSCAN clustering algorithm
 * Groups vectors based on density and similarity threshold
 */
export function dbscanCluster(
  vectors: number[][],
  similarityThreshold: number = DEFAULT_SIMILARITY_THRESHOLD,
  minPoints: number = DEFAULT_DBSCAN_MIN_POINTS
): number[] {
  const n = vectors.length;
  const labels = new Array(n).fill(-1); // -1 = unvisited
  let clusterId = 0;

  // Precompute neighbors for each point
  const neighbors: number[][] = new Array(n);
  for (let i = 0; i < n; i++) {
    neighbors[i] = [];
    for (let j = 0; j < n; j++) {
      if (i !== j && cosineSimilarity(vectors[i], vectors[j]) >= similarityThreshold) {
        neighbors[i].push(j);
      }
    }
  }

  for (let i = 0; i < n; i++) {
    if (labels[i] !== -1) continue; // Already processed

    const neighborIndices = neighbors[i];

    if (neighborIndices.length < minPoints) {
      // Not enough neighbors - assign to own cluster (noise becomes single-item cluster)
      labels[i] = clusterId++;
      continue;
    }

    // Start a new cluster
    const currentCluster = clusterId++;
    labels[i] = currentCluster;

    // Expand cluster
    const queue = [...neighborIndices];
    const visited = new Set<number>([i]);

    while (queue.length > 0) {
      const j = queue.shift()!;
      if (visited.has(j)) continue;
      visited.add(j);

      if (labels[j] === -1) {
        labels[j] = currentCluster;

        // Add j's neighbors to queue if it's a core point
        if (neighbors[j].length >= minPoints) {
          for (const k of neighbors[j]) {
            if (!visited.has(k)) {
              queue.push(k);
            }
          }
        }
      }
    }
  }

  return labels;
}

/**
 * Union-Find (Disjoint Set) data structure with path compression and union by rank.
 * Used internally by hierarchicalCluster for O(n^2) clustering instead of O(n^3).
 */
class UnionFind {
  private parent: number[];
  private rank: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
    this.rank = new Array(size).fill(0);
  }

  /** Find the root of the set containing x, with path compression */
  find(x: number): number {
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x]);
    }
    return this.parent[x];
  }

  /** Merge the sets containing x and y, using union by rank */
  union(x: number, y: number): void {
    const rootX = this.find(x);
    const rootY = this.find(y);
    if (rootX === rootY) return;

    if (this.rank[rootX] < this.rank[rootY]) {
      this.parent[rootX] = rootY;
    } else if (this.rank[rootX] > this.rank[rootY]) {
      this.parent[rootY] = rootX;
    } else {
      this.parent[rootY] = rootX;
      this.rank[rootX]++;
    }
  }
}

/**
 * Hierarchical clustering using Union-Find
 *
 * Replaces the previous O(n^3) agglomerative approach with an O(n^2) single-pass
 * Union-Find algorithm. For each pair (i, j) where similarity >= threshold, we
 * union them into the same cluster. This produces single-linkage-like behavior:
 * if A~B and B~C, then A, B, C share a cluster even when A and C are dissimilar.
 *
 * The downstream deduplicateByEmbedding step (0.85 threshold) catches any
 * near-duplicates that slip through, so this trade-off is acceptable.
 */
export function hierarchicalCluster(
  vectors: number[][],
  similarityThreshold: number = DEFAULT_SIMILARITY_THRESHOLD
): number[] {
  const n = vectors.length;
  if (n === 0) return [];
  if (n === 1) return [0];

  // Precompute similarity matrix — O(n^2 * d), irreducible cost
  const simMatrix = computeSimilarityMatrix(vectors);

  // Union-Find: single pass over upper triangle — O(n^2 * alpha(n)) ~ O(n^2)
  const uf = new UnionFind(n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (simMatrix[i][j] >= similarityThreshold) {
        uf.union(i, j);
      }
    }
  }

  // Map each unique root to a sequential cluster label
  const rootToLabel = new Map<number, number>();
  let nextLabel = 0;
  const labels = new Array<number>(n);

  for (let i = 0; i < n; i++) {
    const root = uf.find(i);
    if (!rootToLabel.has(root)) {
      rootToLabel.set(root, nextLabel++);
    }
    labels[i] = rootToLabel.get(root)!;
  }

  return labels;
}

/**
 * Group indices by their cluster labels
 */
export function groupByCluster(labels: number[]): Map<number, number[]> {
  const groups = new Map<number, number[]>();

  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if (!groups.has(label)) {
      groups.set(label, []);
    }
    groups.get(label)!.push(i);
  }

  return groups;
}

/**
 * Find the centroid of a cluster (average of all vectors)
 */
export function computeCentroid(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];

  const dim = vectors[0].length;
  const centroid = new Array(dim).fill(0);

  for (const vec of vectors) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += vec[i];
    }
  }

  for (let i = 0; i < dim; i++) {
    centroid[i] /= vectors.length;
  }

  return centroid;
}

/**
 * Find the vector closest to the centroid (most representative)
 */
export function findMostCentral(vectors: number[][]): number {
  if (vectors.length === 0) return -1;
  if (vectors.length === 1) return 0;

  const centroid = computeCentroid(vectors);
  let bestIndex = 0;
  let bestSim = -Infinity;

  for (let i = 0; i < vectors.length; i++) {
    const sim = cosineSimilarity(vectors[i], centroid);
    if (sim > bestSim) {
      bestSim = sim;
      bestIndex = i;
    }
  }

  return bestIndex;
}
