/**
 * awattar.at API integration for electricity price data.
 * Uses proxy in dev if CORS blocks direct requests.
 * Prices are cached for 1 hour.
 */

export interface PriceSlot {
  start_timestamp: number;
  end_timestamp: number;
  marketprice: number;
  unit: string;
}

export interface MarketDataResponse {
  object: string;
  data: PriceSlot[];
}

const API_BASE =
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? '/api/awattar'
    : 'https://api.awattar.at';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry {
  data: PriceSlot[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(startMs: number, endMs: number): string {
  return `${startMs}-${endMs}`;
}

/**
 * Fetch hourly electricity prices from awattar.at for the given time range.
 * Results are cached for 1 hour.
 * @param startMs - Start time (Unix epoch milliseconds)
 * @param endMs - End time (Unix epoch milliseconds)
 * @returns Array of hourly price slots
 */
export async function fetchPriceData(
  startMs: number,
  endMs: number
): Promise<PriceSlot[]> {
  const key = cacheKey(startMs, endMs);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }
  const url = `${API_BASE}/v1/marketdata?start=${startMs}&end=${endMs}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`awattar API error: ${res.status} ${res.statusText}`);
  }
  const json: MarketDataResponse = await res.json();
  const data = json.data ?? [];
  cache.set(key, { data, expiresAt: now + CACHE_TTL_MS });
  return data;
}
