/**
 * Tests for the Deduplication and Clustering Module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RawPost } from '../../src/scrapers/types';
import {
  cosineSimilarity,
  computeSimilarityMatrix,
  findSimilarPairs,
  dbscanCluster,
  hierarchicalCluster,
  groupByCluster,
  computeCentroid,
  findMostCentral,
} from '../../src/analysis/similarity';
import {
  prepareTextForEmbedding,
  createRandomEmbedding,
} from '../../src/analysis/embeddings';
import {
  getClusterStats,
  exportClusters,
  type ProblemCluster,
} from '../../src/analysis/deduplicator';

// Helper to create mock posts
function createMockPost(overrides: Partial<RawPost> = {}): RawPost {
  return {
    id: `post_${Math.random().toString(36).slice(2, 8)}`,
    source: 'reddit',
    sourceId: 'abc123',
    title: 'Test post title',
    body: 'Test post body content',
    url: 'https://reddit.com/r/test/123',
    author: 'testuser',
    score: 100,
    commentCount: 25,
    createdAt: new Date(),
    scrapedAt: new Date(),
    signals: [],
    ...overrides,
  };
}

describe('Similarity Utils', () => {
  describe('cosineSimilarity', () => {
    it('returns 1 for identical vectors', () => {
      const vec = [1, 2, 3, 4, 5];
      expect(cosineSimilarity(vec, vec)).toBeCloseTo(1.0);
    });

    it('returns 0 for orthogonal vectors', () => {
      const vecA = [1, 0, 0];
      const vecB = [0, 1, 0];
      expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(0.0);
    });

    it('returns -1 for opposite vectors', () => {
      const vecA = [1, 2, 3];
      const vecB = [-1, -2, -3];
      expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(-1.0);
    });

    it('handles zero vectors', () => {
      const vecA = [0, 0, 0];
      const vecB = [1, 2, 3];
      expect(cosineSimilarity(vecA, vecB)).toBe(0);
    });

    it('throws on dimension mismatch', () => {
      const vecA = [1, 2, 3];
      const vecB = [1, 2];
      expect(() => cosineSimilarity(vecA, vecB)).toThrow('dimension mismatch');
    });

    it('computes correct similarity for non-trivial vectors', () => {
      const vecA = [1, 2, 3];
      const vecB = [4, 5, 6];
      // Manually computed: dot=32, magA=sqrt(14), magB=sqrt(77)
      const expected = 32 / (Math.sqrt(14) * Math.sqrt(77));
      expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(expected);
    });
  });

  describe('computeSimilarityMatrix', () => {
    it('returns empty matrix for empty input', () => {
      expect(computeSimilarityMatrix([])).toEqual([]);
    });

    it('returns 1x1 matrix with 1.0 for single vector', () => {
      const matrix = computeSimilarityMatrix([[1, 2, 3]]);
      expect(matrix).toEqual([[1.0]]);
    });

    it('creates symmetric matrix', () => {
      const vectors = [
        [1, 0, 0],
        [0, 1, 0],
        [1, 1, 0],
      ];
      const matrix = computeSimilarityMatrix(vectors);

      // Check symmetry
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          expect(matrix[i][j]).toBeCloseTo(matrix[j][i]);
        }
      }

      // Check diagonal is 1.0
      expect(matrix[0][0]).toBe(1.0);
      expect(matrix[1][1]).toBe(1.0);
      expect(matrix[2][2]).toBe(1.0);
    });
  });

  describe('findSimilarPairs', () => {
    it('returns empty array when no pairs above threshold', () => {
      const vectors = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ];
      const pairs = findSimilarPairs(vectors, 0.9);
      expect(pairs).toEqual([]);
    });

    it('finds similar pairs above threshold', () => {
      const vectors = [
        [1, 0, 0],
        [0.9, 0.1, 0],
        [0, 1, 0],
      ];
      const pairs = findSimilarPairs(vectors, 0.8);

      expect(pairs.length).toBe(1);
      expect(pairs[0][0]).toBe(0);
      expect(pairs[0][1]).toBe(1);
      expect(pairs[0][2]).toBeGreaterThan(0.8);
    });

    it('sorts pairs by similarity descending', () => {
      const vectors = [
        [1, 0, 0],
        [0.9, 0.1, 0],
        [0.95, 0.05, 0],
      ];
      const pairs = findSimilarPairs(vectors, 0.8);

      expect(pairs.length).toBe(3);
      // Check sorted in descending order
      for (let i = 0; i < pairs.length - 1; i++) {
        expect(pairs[i][2]).toBeGreaterThanOrEqual(pairs[i + 1][2]);
      }
    });
  });

  describe('dbscanCluster', () => {
    it('returns empty array for empty input', () => {
      expect(dbscanCluster([])).toEqual([]);
    });

    it('assigns each isolated point to its own cluster', () => {
      const vectors = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ];
      const labels = dbscanCluster(vectors, 0.9);

      // Each should be in a different cluster
      const uniqueLabels = new Set(labels);
      expect(uniqueLabels.size).toBe(3);
    });

    it('groups similar vectors together', () => {
      const vectors = [
        [1, 0, 0],
        [0.99, 0.01, 0],
        [0, 1, 0],
        [0.01, 0.99, 0],
      ];
      const labels = dbscanCluster(vectors, 0.95);

      // First two should be in same cluster
      expect(labels[0]).toBe(labels[1]);
      // Last two should be in same cluster
      expect(labels[2]).toBe(labels[3]);
      // But different from first two
      expect(labels[0]).not.toBe(labels[2]);
    });
  });

  describe('hierarchicalCluster', () => {
    it('returns empty array for empty input', () => {
      expect(hierarchicalCluster([])).toEqual([]);
    });

    it('returns [0] for single vector', () => {
      expect(hierarchicalCluster([[1, 2, 3]])).toEqual([0]);
    });

    it('merges similar vectors', () => {
      const vectors = [
        [1, 0, 0],
        [0.99, 0.01, 0],
        [0, 1, 0],
      ];
      const labels = hierarchicalCluster(vectors, 0.9);

      // First two should be same cluster
      expect(labels[0]).toBe(labels[1]);
      // Third should be different
      expect(labels[0]).not.toBe(labels[2]);
    });

    it('does not merge vectors below threshold', () => {
      const vectors = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ];
      const labels = hierarchicalCluster(vectors, 0.9);

      // All should be in different clusters
      const uniqueLabels = new Set(labels);
      expect(uniqueLabels.size).toBe(3);
    });
  });

  describe('groupByCluster', () => {
    it('groups indices by label', () => {
      const labels = [0, 1, 0, 2, 1, 0];
      const groups = groupByCluster(labels);

      expect(groups.get(0)).toEqual([0, 2, 5]);
      expect(groups.get(1)).toEqual([1, 4]);
      expect(groups.get(2)).toEqual([3]);
    });

    it('handles empty input', () => {
      const groups = groupByCluster([]);
      expect(groups.size).toBe(0);
    });
  });

  describe('computeCentroid', () => {
    it('returns empty array for empty input', () => {
      expect(computeCentroid([])).toEqual([]);
    });

    it('returns same vector for single input', () => {
      const vec = [1, 2, 3];
      expect(computeCentroid([vec])).toEqual(vec);
    });

    it('computes average of vectors', () => {
      const vectors = [
        [2, 4, 6],
        [4, 6, 8],
      ];
      const centroid = computeCentroid(vectors);
      expect(centroid).toEqual([3, 5, 7]);
    });
  });

  describe('findMostCentral', () => {
    it('returns -1 for empty input', () => {
      expect(findMostCentral([])).toBe(-1);
    });

    it('returns 0 for single vector', () => {
      expect(findMostCentral([[1, 2, 3]])).toBe(0);
    });

    it('finds vector closest to centroid', () => {
      const vectors = [
        [1, 0, 0],  // Far from centroid
        [0.5, 0.5, 0],  // Close to centroid
        [0, 1, 0],  // Far from centroid
      ];
      const centralIndex = findMostCentral(vectors);
      expect(centralIndex).toBe(1);
    });
  });
});

describe('Embedding Utils', () => {
  describe('prepareTextForEmbedding', () => {
    it('combines title and body', () => {
      const result = prepareTextForEmbedding('My Title', 'My body content');
      expect(result).toBe('My Title\n\nMy body content');
    });

    it('truncates body to max chars', () => {
      const longBody = 'a'.repeat(1000);
      const result = prepareTextForEmbedding('Title', longBody, 100);
      expect(result.length).toBeLessThanOrEqual('Title\n\n'.length + 100);
    });

    it('handles empty body', () => {
      const result = prepareTextForEmbedding('Title', '');
      expect(result).toBe('Title');
    });
  });

  describe('createRandomEmbedding', () => {
    it('creates 1536-dimensional vector', () => {
      const embedding = createRandomEmbedding();
      expect(embedding.length).toBe(1536);
    });

    it('creates unit vector', () => {
      const embedding = createRandomEmbedding();
      const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
      expect(magnitude).toBeCloseTo(1.0, 5);
    });
  });
});

describe('Deduplicator Utils', () => {
  describe('getClusterStats', () => {
    it('calculates statistics correctly', () => {
      const mockClusters: ProblemCluster[] = [
        {
          id: 'cluster1',
          representativePost: createMockPost({ source: 'reddit' }),
          relatedPosts: [createMockPost({ source: 'hn' })],
          frequency: 2,
          totalScore: 150,
          embedding: [],
          problemStatement: 'Problem 1',
          sources: ['reddit', 'hn'],
        },
        {
          id: 'cluster2',
          representativePost: createMockPost({ source: 'twitter' }),
          relatedPosts: [],
          frequency: 1,
          totalScore: 50,
          embedding: [],
          problemStatement: 'Problem 2',
          sources: ['twitter'],
        },
      ];

      const stats = getClusterStats(mockClusters);

      expect(stats.totalClusters).toBe(2);
      expect(stats.totalPosts).toBe(3);
      expect(stats.averageClusterSize).toBeCloseTo(1.5);
      expect(stats.sourceDistribution.reddit).toBe(1);
      expect(stats.sourceDistribution.hn).toBe(1);
      expect(stats.sourceDistribution.twitter).toBe(1);
      expect(stats.topProblems.length).toBe(2);
    });

    it('handles empty clusters', () => {
      const stats = getClusterStats([]);
      expect(stats.totalClusters).toBe(0);
      expect(stats.totalPosts).toBe(0);
    });
  });

  describe('exportClusters', () => {
    it('exports to valid JSON', () => {
      const mockClusters: ProblemCluster[] = [
        {
          id: 'cluster1',
          representativePost: createMockPost({ title: 'Test Problem' }),
          relatedPosts: [],
          frequency: 1,
          totalScore: 100,
          embedding: [0.1, 0.2],
          problemStatement: 'A test problem statement',
          sources: ['reddit'],
        },
      ];

      const json = exportClusters(mockClusters);
      const parsed = JSON.parse(json);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe('cluster1');
      expect(parsed[0].problemStatement).toBe('A test problem statement');
      expect(parsed[0].relatedPostCount).toBe(0);
    });
  });
});

describe('Clustering Integration', () => {
  it('clusters similar mock embeddings correctly', () => {
    // Create two groups of similar vectors
    const group1 = [
      [1, 0, 0, 0],
      [0.98, 0.02, 0, 0],
      [0.99, 0.01, 0, 0],
    ];
    const group2 = [
      [0, 1, 0, 0],
      [0.02, 0.98, 0, 0],
    ];
    const isolated = [[0, 0, 1, 0]];

    const allVectors = [...group1, ...group2, ...isolated];
    const labels = hierarchicalCluster(allVectors, 0.9);

    // Group 1 should be in same cluster
    expect(labels[0]).toBe(labels[1]);
    expect(labels[1]).toBe(labels[2]);

    // Group 2 should be in same cluster
    expect(labels[3]).toBe(labels[4]);

    // Groups should be different from each other and from isolated
    expect(labels[0]).not.toBe(labels[3]);
    expect(labels[0]).not.toBe(labels[5]);
    expect(labels[3]).not.toBe(labels[5]);
  });

  it('reduces vector count appropriately', () => {
    // Simulate 100 vectors with some clusters
    const vectors: number[][] = [];

    // Add 10 clusters of 8-12 similar vectors each
    for (let cluster = 0; cluster < 10; cluster++) {
      const baseVec = createRandomEmbedding();
      const clusterSize = 8 + Math.floor(Math.random() * 5);

      for (let i = 0; i < clusterSize; i++) {
        // Add small noise (0.01 to ensure > 0.95 similarity)
        const noisyVec = baseVec.map(v => v + (Math.random() - 0.5) * 0.01);
        const magnitude = Math.sqrt(noisyVec.reduce((sum, x) => sum + x * x, 0));
        vectors.push(noisyVec.map(v => v / magnitude));
      }
    }

    const labels = hierarchicalCluster(vectors, 0.95);
    const clusterCount = new Set(labels).size;

    // Should reduce to approximately 10 clusters
    expect(clusterCount).toBeLessThanOrEqual(15);
    expect(clusterCount).toBeGreaterThanOrEqual(8);
  });
});
