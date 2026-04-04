/**
 * Analysis Module for ZeroToShip
 *
 * Provides deduplication and clustering capabilities for scraped posts.
 */

export {
  clusterPosts,
  mergeIntoClusters,
  exportClusters,
  getClusterStats,
  type ProblemCluster,
  type ClusteringOptions,
} from './deduplicator';

export {
  EmbeddingClient,
  prepareTextForEmbedding,
  createZeroEmbedding,
  createRandomEmbedding,
  type EmbeddingResult,
  type EmbeddingCache,
} from './embeddings';

export {
  cosineSimilarity,
  computeSimilarityMatrix,
  findSimilarPairs,
  dbscanCluster,
  hierarchicalCluster,
  groupByCluster,
  computeCentroid,
  findMostCentral,
} from './similarity';

export {
  scoreProblem,
  scoreAll,
  getScoringStats,
  exportScoredProblems,
  filterByPriority,
  filterByEffort,
  getWeekendProjects,
  type ScoredProblem,
  type ProblemScores,
  type ScoreReasoning,
  type ScoringOptions,
} from './scorer';

export {
  buildScoringPrompt,
  parseScoreResponse,
  createDefaultScores,
  SCORING_SYSTEM_PROMPT,
  type ScoreResponse,
} from './score-prompts';

// Gap Analysis Module
export {
  analyzeGaps,
  analyzeAllGaps,
  filterByOpportunity,
  sortByOpportunity,
  getGapAnalysisStats,
  exportGapAnalyses,
  formatGapAnalysisMarkdown,
  type GapAnalysis,
  type GapAnalysisConfig,
} from './gap-analyzer';

export {
  WebSearchClient,
  generateSearchQueries,
  type SearchResult,
  type SearchResponse,
  type WebSearchConfig,
} from './web-search';

export {
  analyzeCompetitors,
  filterProductResults,
  createFallbackAnalysis,
  calculateCompetitionScore,
  summarizeAnalysis,
  type Competitor,
  type CompetitorAnalysis,
  type CompetitorAnalysisOptions,
} from './competitor';

// Score Cache (pipeline-level dedup)
export {
  ScoreCache,
  getCacheKey,
  type ScoreCacheOptions,
} from './score-cache';
