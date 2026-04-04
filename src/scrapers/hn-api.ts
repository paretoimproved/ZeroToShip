/**
 * Hacker News Algolia API Client
 *
 * API Documentation: https://hn.algolia.com/api
 * Base URL: https://hn.algolia.com/api/v1/
 *
 * Endpoints:
 * - /search - Search by relevance
 * - /search_by_date - Search by date (most recent first)
 * - /items/{id} - Get single item by ID
 */

const HN_API_BASE = 'https://hn.algolia.com/api/v1';

/**
 * Algolia API response for a single hit
 */
export interface HNAlgoliaHit {
  objectID: string;
  title?: string;
  url?: string;
  author: string;
  points: number | null;
  story_text?: string;
  comment_text?: string;
  num_comments?: number;
  story_id?: number;
  story_title?: string;
  story_url?: string;
  parent_id?: number;
  created_at: string;
  created_at_i: number;
  _tags: string[];
}

/**
 * Algolia API search response
 */
export interface HNAlgoliaResponse {
  hits: HNAlgoliaHit[];
  nbHits: number;
  page: number;
  nbPages: number;
  hitsPerPage: number;
  exhaustiveNbHits: boolean;
  query: string;
  params: string;
}

/**
 * Full item response from /items/{id} endpoint
 */
export interface HNItem {
  id: number;
  created_at: string;
  created_at_i: number;
  type: 'story' | 'comment' | 'job' | 'poll' | 'pollopt';
  author: string;
  title?: string;
  url?: string;
  text?: string;
  points: number | null;
  parent_id?: number;
  story_id?: number;
  children: HNItem[];
}

/**
 * Search parameters for the API
 */
export interface HNSearchParams {
  query?: string;
  tags?: string | string[];
  numericFilters?: string;
  page?: number;
  hitsPerPage?: number;
}

/**
 * Build query string from parameters
 */
function buildQueryString(params: HNSearchParams): string {
  const parts: string[] = [];

  if (params.query) {
    parts.push(`query=${encodeURIComponent(params.query)}`);
  }

  if (params.tags) {
    const tags = Array.isArray(params.tags) ? params.tags.join(',') : params.tags;
    parts.push(`tags=${encodeURIComponent(tags)}`);
  }

  if (params.numericFilters) {
    parts.push(`numericFilters=${encodeURIComponent(params.numericFilters)}`);
  }

  if (params.page !== undefined) {
    parts.push(`page=${params.page}`);
  }

  if (params.hitsPerPage !== undefined) {
    parts.push(`hitsPerPage=${params.hitsPerPage}`);
  }

  return parts.join('&');
}

/**
 * Fetch wrapper with error handling and retry logic
 */
async function fetchWithRetry(
  url: string,
  maxRetries = 3,
  delayMs = 1000
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return response;
      }

      if (response.status === 429) {
        // Rate limited - wait longer
        await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1) * 2));
        continue;
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error('Failed to fetch after retries');
}

/**
 * Search HN by relevance
 */
export async function search(params: HNSearchParams): Promise<HNAlgoliaResponse> {
  const queryString = buildQueryString(params);
  const url = `${HN_API_BASE}/search?${queryString}`;

  const response = await fetchWithRetry(url);
  return (await response.json()) as HNAlgoliaResponse;
}

/**
 * Search HN by date (most recent first)
 */
export async function searchByDate(params: HNSearchParams): Promise<HNAlgoliaResponse> {
  const queryString = buildQueryString(params);
  const url = `${HN_API_BASE}/search_by_date?${queryString}`;

  const response = await fetchWithRetry(url);
  return (await response.json()) as HNAlgoliaResponse;
}

/**
 * Get a single item by ID (includes full comment tree)
 */
export async function getItem(id: number | string): Promise<HNItem> {
  const url = `${HN_API_BASE}/items/${id}`;

  const response = await fetchWithRetry(url);
  return (await response.json()) as HNItem;
}

/**
 * Search for Ask HN posts within a time window
 */
export async function searchAskHN(
  query: string,
  hoursBack: number,
  page = 0,
  hitsPerPage = 50
): Promise<HNAlgoliaResponse> {
  const minTimestamp = Math.floor(Date.now() / 1000) - hoursBack * 3600;

  return searchByDate({
    query,
    tags: 'ask_hn',
    numericFilters: `created_at_i>${minTimestamp}`,
    page,
    hitsPerPage,
  });
}

/**
 * Search for Show HN posts within a time window
 */
export async function searchShowHN(
  hoursBack: number,
  page = 0,
  hitsPerPage = 50
): Promise<HNAlgoliaResponse> {
  const minTimestamp = Math.floor(Date.now() / 1000) - hoursBack * 3600;

  return searchByDate({
    tags: 'show_hn',
    numericFilters: `created_at_i>${minTimestamp}`,
    page,
    hitsPerPage,
  });
}

/**
 * Search for stories matching a query within a time window
 */
export async function searchStories(
  query: string,
  hoursBack: number,
  page = 0,
  hitsPerPage = 50
): Promise<HNAlgoliaResponse> {
  const minTimestamp = Math.floor(Date.now() / 1000) - hoursBack * 3600;

  return searchByDate({
    query,
    tags: 'story',
    numericFilters: `created_at_i>${minTimestamp}`,
    page,
    hitsPerPage,
  });
}

/**
 * Search for comments matching a query within a time window
 */
export async function searchComments(
  query: string,
  hoursBack: number,
  page = 0,
  hitsPerPage = 50
): Promise<HNAlgoliaResponse> {
  const minTimestamp = Math.floor(Date.now() / 1000) - hoursBack * 3600;

  return searchByDate({
    query,
    tags: 'comment',
    numericFilters: `created_at_i>${minTimestamp}`,
    page,
    hitsPerPage,
  });
}

/**
 * Get front page stories (by points, recent)
 */
export async function getFrontPage(
  hoursBack: number,
  minPoints = 10,
  hitsPerPage = 30
): Promise<HNAlgoliaResponse> {
  const minTimestamp = Math.floor(Date.now() / 1000) - hoursBack * 3600;

  return search({
    tags: 'front_page,story',
    numericFilters: `created_at_i>${minTimestamp},points>${minPoints}`,
    hitsPerPage,
  });
}
