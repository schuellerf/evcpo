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

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getRegion(): 'at' | 'de' {
  if (typeof window === 'undefined') return 'at';
  const stored = localStorage.getItem('evcpo-region');
  if (stored === 'at' || stored === 'de') return stored;
  return 'at';
}

function getApiBaseUrl(): string {
  const region = getRegion();
  const base = region === 'at' ? 'https://api.awattar.at' : 'https://api.awattar.de';
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return region === 'at' ? '/api/awattar-at' : '/api/awattar-de';
  }
  return base;
}

interface CacheEntry {
  data: PriceSlot[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(startMs: number, endMs: number, region: string): string {
  return `${region}-${startMs}-${endMs}`;
}

export function clearPriceCache(): void {
  cache.clear();
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
  const region = getRegion();
  const key = cacheKey(startMs, endMs, region);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }
  const apiBase = getApiBaseUrl();
  const url = `${apiBase}/v1/marketdata?start=${startMs}&end=${endMs}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`awattar API error: ${res.status} ${res.statusText}`);
  }
  const json: MarketDataResponse = await res.json();
  const data = json.data ?? [];
  cache.set(key, { data, expiresAt: now + CACHE_TTL_MS });
  return data;
}
