/**
 * awattar.at API integration for electricity price data.
 * Uses proxy in dev if CORS blocks direct requests.
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

/**
 * Fetch hourly electricity prices from awattar.at for the given time range.
 * @param startMs - Start time (Unix epoch milliseconds)
 * @param endMs - End time (Unix epoch milliseconds)
 * @returns Array of hourly price slots
 */
export async function fetchPriceData(
  startMs: number,
  endMs: number
): Promise<PriceSlot[]> {
  const url = `${API_BASE}/v1/marketdata?start=${startMs}&end=${endMs}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`awattar API error: ${res.status} ${res.statusText}`);
  }
  const json: MarketDataResponse = await res.json();
  return json.data ?? [];
}
