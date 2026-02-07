/**
 * Post Deduplication and Clustering for IdeaForge
 *
 * Takes raw posts from multiple sources, generates embeddings,
 * clusters similar posts together, and outputs deduplicated problem statements.
 */

import type { RawPost } from '../scrapers/types';
import { EmbeddingClient, prepareTextForEmbedding } from './embeddings';
import { config } from '../config/env';
import logger from '../lib/logger';
import {
  hierarchicalCluster,
  groupByCluster,
  findMostCentral,
  computeCentroid,
  DEFAULT_SIMILARITY_THRESHOLD,
} from './similarity';
import { calculateSignalStrength } from '../scrapers/signals';
import { getBatchModel } from '../config/models';
import { getGlobalMetrics } from '../scheduler/utils/api-metrics';
import { estimateTokens } from '../scheduler/utils/token-estimator';

/**
 * A cluster of related posts describing the same problem
 */
export interface ProblemCluster {
  id: string;
  representativePost: RawPost;
  relatedPosts: RawPost[];
  frequency: number;
  totalScore: number;
  embedding: number[];
  problemStatement: string;
  sources: ('reddit' | 'hn' | 'twitter' | 'github')[];
}

/**
 * Options for the clustering process
 */
/** Default max characters from post body for embedding input */
const DEFAULT_MAX_BODY_CHARS = 500;

export interface ClusteringOptions {
  similarityThreshold?: number;   // Default: DEFAULT_SIMILARITY_THRESHOLD (0.85)
  maxBodyChars?: number;          // Default: DEFAULT_MAX_BODY_CHARS (500)
  generateSummaries?: boolean;    // Default: true
  cacheDir?: string;              // Directory for embedding cache
  openaiApiKey?: string;          // OpenAI API key for embeddings (defaults to env)
  anthropicApiKey?: string;       // Anthropic API key for summaries (defaults to env)
}

const DEFAULT_OPTIONS: Required<ClusteringOptions> = {
  similarityThreshold: DEFAULT_SIMILARITY_THRESHOLD,
  maxBodyChars: DEFAULT_MAX_BODY_CHARS,
  generateSummaries: true,
  cacheDir: '',
  openaiApiKey: '',
  anthropicApiKey: '',
};

/**
 * Batch size for generating problem statements
 * Batching 20 clusters per call reduces API calls from ~174 to ~9 per run
 */
const STATEMENT_BATCH_SIZE = 20;

/** Max tokens for a single problem statement API call */
const STATEMENT_MAX_TOKENS = 150;

/** Max tokens for a batch problem statement API call */
const STATEMENT_BATCH_MAX_TOKENS = 3000;

/** Max posts to include as context when generating a single statement */
const MAX_CONTEXT_POSTS = 5;

/** Max characters to include from each post body in context */
const BODY_SNIPPET_CHARS = 200;

/** Max posts per cluster in batch statement prompts */
const BATCH_POST_LIMIT = 3;

/** Max body characters per post in batch statement prompts */
const BATCH_BODY_SNIPPET_CHARS = 150;

/** Number of top problems to display in cluster stats */
const TOP_PROBLEMS_DISPLAY_LIMIT = 10;

/**
 * Generate a unique cluster ID
 */
function generateClusterId(): string {
  return `cluster_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Select the best representative post from a cluster
 * Prioritizes by: signal strength, score, comment count
 */
function selectRepresentative(posts: RawPost[]): RawPost {
  if (posts.length === 1) return posts[0];

  return posts.reduce((best, post) => {
    const bestStrength = calculateSignalStrength(best.title + ' ' + best.body);
    const postStrength = calculateSignalStrength(post.title + ' ' + post.body);

    // Primary: signal strength
    if (postStrength > bestStrength) return post;
    if (postStrength < bestStrength) return best;

    // Secondary: score (upvotes)
    if (post.score > best.score) return post;
    if (post.score < best.score) return best;

    // Tertiary: comment count (engagement)
    if (post.commentCount > best.commentCount) return post;

    return best;
  });
}

/**
 * Aggregate sources from all posts in a cluster
 */
function aggregateSources(posts: RawPost[]): ('reddit' | 'hn' | 'twitter' | 'github')[] {
  const sources = new Set<'reddit' | 'hn' | 'twitter' | 'github'>();
  for (const post of posts) {
    sources.add(post.source);
  }
  return Array.from(sources);
}

/**
 * Calculate total score across all posts in a cluster
 */
function calculateTotalScore(posts: RawPost[]): number {
  return posts.reduce((sum, post) => sum + post.score, 0);
}

/**
 * Generate a problem statement summary using Anthropic Claude
 */
async function generateProblemStatement(
  posts: RawPost[],
  anthropicApiKey: string
): Promise<string> {
  const representative = selectRepresentative(posts);

  // Prepare context from multiple posts
  const postSummaries = posts
    .slice(0, MAX_CONTEXT_POSTS)
    .map(p => `- ${p.title}${p.body ? `: ${p.body.slice(0, BODY_SNIPPET_CHARS)}` : ''}`)
    .join('\n');

  const prompt = `Based on these related posts about a problem or need, write a concise problem statement (1-2 sentences) that captures the core issue:

${postSummaries}

Problem statement:`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: getBatchModel(),
        max_tokens: STATEMENT_MAX_TOKENS,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, 'Failed to generate problem statement');
      return representative.title;
    }

    const data = await response.json() as {
      content: Array<{ type: string; text: string }>;
    };

    return data.content[0]?.text?.trim() || representative.title;
  } catch (error) {
    logger.warn({ err: error }, 'Error generating problem statement');
    return representative.title;
  }
}

/**
 * Create a fallback problem statement without AI
 */
function createFallbackStatement(posts: RawPost[]): string {
  const representative = selectRepresentative(posts);
  return representative.title;
}

/**
 * Build prompt for generating multiple problem statements in a single call
 */
function buildBatchStatementPrompt(
  clusters: Array<{ id: string; posts: RawPost[] }>
): string {
  const clustersList = clusters.map((c, i) => {
    const postSummaries = c.posts
      .slice(0, BATCH_POST_LIMIT)
      .map(p => `- ${p.title}${p.body ? `: ${p.body.slice(0, BATCH_BODY_SNIPPET_CHARS)}` : ''}`)
      .join('\n');

    return `## Cluster ${i + 1} (ID: ${c.id})
Posts:
${postSummaries}`;
  }).join('\n\n---\n\n');

  return `For each cluster of related posts, write a concise problem statement (1-2 sentences) that captures the core issue.

${clustersList}

Respond with JSON array:
[
  { "id": "cluster_id", "statement": "Problem statement here" },
  ...
]`;
}

/**
 * Generate problem statements for multiple clusters in one API call
 * Reduces API calls from N to ceil(N/20) for significant cost savings
 */
async function generateProblemStatementsBatch(
  clusters: Array<{ id: string; posts: RawPost[] }>,
  anthropicApiKey: string
): Promise<Map<string, string>> {
  const startTime = Date.now();
  const prompt = buildBatchStatementPrompt(clusters);
  const model = getBatchModel();
  const inputTokens = estimateTokens(prompt);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: STATEMENT_BATCH_MAX_TOKENS,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      // Record failed call
      getGlobalMetrics().recordCall({
        timestamp: new Date(),
        module: 'deduplicator',
        model,
        batchSize: clusters.length,
        itemsProcessed: 0,
        inputTokens,
        outputTokens: 0,
        success: false,
        durationMs: Date.now() - startTime,
      });
      throw new Error(`Batch statement generation failed: ${response.status}`);
    }

    const data = await response.json() as {
      content: Array<{ type: string; text: string }>;
    };
    const content = data.content[0]?.text;

    // Record successful call
    getGlobalMetrics().recordCall({
      timestamp: new Date(),
      module: 'deduplicator',
      model,
      batchSize: clusters.length,
      itemsProcessed: clusters.length,
      inputTokens,
      outputTokens: estimateTokens(content || ''),
      success: true,
      durationMs: Date.now() - startTime,
    });

    // Parse JSON response - extract array from response
    const jsonMatch = content?.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array in response');

    const parsed = JSON.parse(jsonMatch[0]) as Array<{ id: string; statement: string }>;

    const results = new Map<string, string>();
    for (const item of parsed) {
      results.set(item.id, item.statement);
    }

    return results;
  } catch (error) {
    logger.warn({ err: error }, 'Batch statement generation failed');
    // Return fallbacks using post titles
    const results = new Map<string, string>();
    for (const c of clusters) {
      results.set(c.id, selectRepresentative(c.posts).title);
    }
    return results;
  }
}

/**
 * Main clustering function
 * Takes raw posts and returns deduplicated problem clusters
 */
export async function clusterPosts(
  posts: RawPost[],
  options: ClusteringOptions = {}
): Promise<ProblemCluster[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (posts.length === 0) return [];

  // Initialize embedding client
  const embeddingClient = new EmbeddingClient(
    opts.openaiApiKey || undefined,
    opts.cacheDir || undefined
  );

  logger.info({ count: posts.length }, 'Clustering posts');

  // Step 1: Prepare texts for embedding
  const texts = posts.map(post =>
    prepareTextForEmbedding(post.title, post.body, opts.maxBodyChars)
  );

  // Step 2: Generate embeddings in batch
  logger.info('Generating embeddings...');
  const embeddingResults = await embeddingClient.embedBatch(texts);
  const embeddings = embeddingResults.map(r => r.embedding);

  const cacheStats = embeddingClient.getCacheStats();
  logger.info({ hits: cacheStats.hits, misses: cacheStats.misses }, 'Embedding cache stats');

  // Step 3: Cluster using hierarchical clustering
  logger.info('Clustering by similarity...');
  const labels = hierarchicalCluster(embeddings, opts.similarityThreshold);

  // Step 4: Group posts by cluster
  const clusterGroups = groupByCluster(labels);
  logger.info({ clusters: clusterGroups.size, posts: posts.length }, 'Clustering results');

  // Step 5: Build cluster data without statements first
  const anthropicKey = opts.anthropicApiKey || config.ANTHROPIC_API_KEY;

  interface ClusterData {
    id: string;
    posts: RawPost[];
    representative: RawPost;
    relatedPosts: RawPost[];
    centroid: number[];
  }

  const clustersData: ClusterData[] = [];

  for (const [_label, indices] of clusterGroups) {
    const clusterPostsList = indices.map(i => posts[i]);
    const clusterEmbeddings = indices.map(i => embeddings[i]);

    // Find most central embedding for the cluster
    const _centralIndex = findMostCentral(clusterEmbeddings);
    const centroid = computeCentroid(clusterEmbeddings);

    // Select representative post
    const representative = selectRepresentative(clusterPostsList);
    const relatedPosts = clusterPostsList.filter(p => p.id !== representative.id);

    clustersData.push({
      id: generateClusterId(),
      posts: clusterPostsList,
      representative,
      relatedPosts,
      centroid,
    });
  }

  // Step 6: Batch generate problem statements
  const statements = new Map<string, string>();

  if (opts.generateSummaries && anthropicKey) {
    logger.info({ clusters: clustersData.length, batchSize: STATEMENT_BATCH_SIZE }, 'Generating problem statements');

    for (let i = 0; i < clustersData.length; i += STATEMENT_BATCH_SIZE) {
      const batch = clustersData.slice(i, i + STATEMENT_BATCH_SIZE);
      const batchStatements = await generateProblemStatementsBatch(
        batch.map(c => ({ id: c.id, posts: c.posts })),
        anthropicKey
      );

      for (const [id, statement] of batchStatements) {
        statements.set(id, statement);
      }

      logger.info({ completed: Math.min(i + STATEMENT_BATCH_SIZE, clustersData.length), total: clustersData.length }, 'Statement generation progress');
    }
  }

  // Step 7: Build final problem clusters with statements
  const clusters: ProblemCluster[] = clustersData.map(c => ({
    id: c.id,
    representativePost: c.representative,
    relatedPosts: c.relatedPosts,
    frequency: c.posts.length,
    totalScore: calculateTotalScore(c.posts),
    embedding: c.centroid,
    problemStatement: statements.get(c.id) || createFallbackStatement(c.posts),
    sources: aggregateSources(c.posts),
  }));

  // Sort by frequency * total score (most significant problems first)
  clusters.sort((a, b) => {
    const scoreA = a.frequency * Math.log10(a.totalScore + 1);
    const scoreB = b.frequency * Math.log10(b.totalScore + 1);
    return scoreB - scoreA;
  });

  logger.info({ uniqueProblems: clusters.length }, 'Clustering complete');

  return clusters;
}

/**
 * Merge new posts into existing clusters
 * Useful for incremental updates
 */
export async function mergeIntoClusters(
  newPosts: RawPost[],
  existingClusters: ProblemCluster[],
  options: ClusteringOptions = {}
): Promise<ProblemCluster[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (newPosts.length === 0) return existingClusters;
  if (existingClusters.length === 0) return clusterPosts(newPosts, options);

  const embeddingClient = new EmbeddingClient(
    opts.openaiApiKey || undefined,
    opts.cacheDir || undefined
  );

  // Generate embeddings for new posts
  const texts = newPosts.map(post =>
    prepareTextForEmbedding(post.title, post.body, opts.maxBodyChars)
  );
  const embeddingResults = await embeddingClient.embedBatch(texts);
  const newEmbeddings = embeddingResults.map(r => r.embedding);

  // Try to assign each new post to an existing cluster
  const unassigned: { post: RawPost; embedding: number[] }[] = [];
  const updatedClusters = [...existingClusters];

  for (let i = 0; i < newPosts.length; i++) {
    const post = newPosts[i];
    const embedding = newEmbeddings[i];

    // Find best matching cluster
    let bestCluster: ProblemCluster | null = null;
    let bestSimilarity = 0;

    for (const cluster of updatedClusters) {
      const sim = cosineSimilarity(embedding, cluster.embedding);
      if (sim >= opts.similarityThreshold && sim > bestSimilarity) {
        bestSimilarity = sim;
        bestCluster = cluster;
      }
    }

    if (bestCluster) {
      // Add to existing cluster
      bestCluster.relatedPosts.push(post);
      bestCluster.frequency++;
      bestCluster.totalScore += post.score;
      if (!bestCluster.sources.includes(post.source)) {
        bestCluster.sources.push(post.source);
      }
      // Update centroid
      const allEmbeddings = [
        bestCluster.embedding,
        ...bestCluster.relatedPosts.map(() => embedding), // Simplified
      ];
      bestCluster.embedding = computeCentroid([bestCluster.embedding, embedding]);
    } else {
      unassigned.push({ post, embedding });
    }
  }

  // Cluster unassigned posts and add as new clusters
  if (unassigned.length > 0) {
    const newClusters = await clusterPosts(
      unassigned.map(u => u.post),
      options
    );
    updatedClusters.push(...newClusters);
  }

  return updatedClusters;
}

// Import for mergeIntoClusters
import { cosineSimilarity } from './similarity';

/**
 * Export cluster data to JSON format
 */
export function exportClusters(clusters: ProblemCluster[]): string {
  return JSON.stringify(
    clusters.map(c => ({
      id: c.id,
      problemStatement: c.problemStatement,
      frequency: c.frequency,
      totalScore: c.totalScore,
      sources: c.sources,
      representativePost: {
        id: c.representativePost.id,
        source: c.representativePost.source,
        title: c.representativePost.title,
        url: c.representativePost.url,
        score: c.representativePost.score,
      },
      relatedPostCount: c.relatedPosts.length,
    })),
    null,
    2
  );
}

/**
 * Get summary statistics for clusters
 */
export function getClusterStats(clusters: ProblemCluster[]): {
  totalClusters: number;
  totalPosts: number;
  averageClusterSize: number;
  sourceDistribution: Record<string, number>;
  topProblems: Array<{ statement: string; frequency: number; score: number }>;
} {
  const totalPosts = clusters.reduce((sum, c) => sum + c.frequency, 0);
  const sourceDistribution: Record<string, number> = {};

  for (const cluster of clusters) {
    for (const source of cluster.sources) {
      sourceDistribution[source] = (sourceDistribution[source] || 0) + 1;
    }
  }

  return {
    totalClusters: clusters.length,
    totalPosts,
    averageClusterSize: totalPosts / clusters.length || 0,
    sourceDistribution,
    topProblems: clusters.slice(0, TOP_PROBLEMS_DISPLAY_LIMIT).map(c => ({
      statement: c.problemStatement,
      frequency: c.frequency,
      score: c.totalScore,
    })),
  };
}
