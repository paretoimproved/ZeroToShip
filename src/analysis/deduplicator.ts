/**
 * Post Deduplication and Clustering for IdeaForge
 *
 * Takes raw posts from multiple sources, generates embeddings,
 * clusters similar posts together, and outputs deduplicated problem statements.
 */

import type { RawPost } from '../scrapers/types';
import { EmbeddingClient, prepareTextForEmbedding } from './embeddings';
import {
  hierarchicalCluster,
  groupByCluster,
  findMostCentral,
  computeCentroid,
} from './similarity';
import { calculateSignalStrength } from '../scrapers/signals';

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
export interface ClusteringOptions {
  similarityThreshold?: number;   // Default: 0.85
  maxBodyChars?: number;          // Default: 500
  generateSummaries?: boolean;    // Default: true
  cacheDir?: string;              // Directory for embedding cache
  openaiApiKey?: string;          // OpenAI API key (defaults to env)
}

const DEFAULT_OPTIONS: Required<ClusteringOptions> = {
  similarityThreshold: 0.85,
  maxBodyChars: 500,
  generateSummaries: true,
  cacheDir: '',
  openaiApiKey: '',
};

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
 * Generate a problem statement summary using OpenAI
 */
async function generateProblemStatement(
  posts: RawPost[],
  openaiApiKey: string
): Promise<string> {
  const representative = selectRepresentative(posts);

  // Prepare context from multiple posts
  const postSummaries = posts
    .slice(0, 5) // Limit to 5 posts for context
    .map(p => `- ${p.title}${p.body ? `: ${p.body.slice(0, 200)}` : ''}`)
    .join('\n');

  const prompt = `Based on these related posts about a problem or need, write a concise problem statement (1-2 sentences) that captures the core issue:

${postSummaries}

Problem statement:`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.warn('Failed to generate problem statement:', response.status);
      return representative.title;
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    return data.choices[0]?.message?.content?.trim() || representative.title;
  } catch (error) {
    console.warn('Error generating problem statement:', error);
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

  console.log(`Clustering ${posts.length} posts...`);

  // Step 1: Prepare texts for embedding
  const texts = posts.map(post =>
    prepareTextForEmbedding(post.title, post.body, opts.maxBodyChars)
  );

  // Step 2: Generate embeddings in batch
  console.log('Generating embeddings...');
  const embeddingResults = await embeddingClient.embedBatch(texts);
  const embeddings = embeddingResults.map(r => r.embedding);

  const cacheStats = embeddingClient.getCacheStats();
  console.log(`Embedding cache: ${cacheStats.hits} hits, ${cacheStats.misses} misses`);

  // Step 3: Cluster using hierarchical clustering
  console.log('Clustering by similarity...');
  const labels = hierarchicalCluster(embeddings, opts.similarityThreshold);

  // Step 4: Group posts by cluster
  const clusterGroups = groupByCluster(labels);
  console.log(`Found ${clusterGroups.size} clusters from ${posts.length} posts`);

  // Step 5: Build problem clusters
  const clusters: ProblemCluster[] = [];
  const openaiKey = opts.openaiApiKey || process.env.OPENAI_API_KEY || '';

  for (const [_label, indices] of clusterGroups) {
    const clusterPosts = indices.map(i => posts[i]);
    const clusterEmbeddings = indices.map(i => embeddings[i]);

    // Find most central embedding for the cluster
    const centralIndex = findMostCentral(clusterEmbeddings);
    const centroid = computeCentroid(clusterEmbeddings);

    // Select representative post
    const representative = selectRepresentative(clusterPosts);
    const relatedPosts = clusterPosts.filter(p => p.id !== representative.id);

    // Generate or create problem statement
    let problemStatement: string;
    if (opts.generateSummaries && openaiKey) {
      problemStatement = await generateProblemStatement(clusterPosts, openaiKey);
    } else {
      problemStatement = createFallbackStatement(clusterPosts);
    }

    clusters.push({
      id: generateClusterId(),
      representativePost: representative,
      relatedPosts,
      frequency: clusterPosts.length,
      totalScore: calculateTotalScore(clusterPosts),
      embedding: centroid,
      problemStatement,
      sources: aggregateSources(clusterPosts),
    });
  }

  // Sort by frequency * total score (most significant problems first)
  clusters.sort((a, b) => {
    const scoreA = a.frequency * Math.log10(a.totalScore + 1);
    const scoreB = b.frequency * Math.log10(b.totalScore + 1);
    return scoreB - scoreA;
  });

  console.log(`Clustering complete: ${clusters.length} unique problems identified`);

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
    topProblems: clusters.slice(0, 10).map(c => ({
      statement: c.problemStatement,
      frequency: c.frequency,
      score: c.totalScore,
    })),
  };
}
