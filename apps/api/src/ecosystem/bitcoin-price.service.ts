import { Injectable, Logger } from '@nestjs/common';

export interface BitcoinPrice {
  priceUsd: number;
  change24hPct: number;
  sparkline7d: number[];
}

interface CoinGeckoSimplePriceResponse {
  bitcoin?: { usd?: number; usd_24h_change?: number };
}

interface CoinGeckoMarketChartResponse {
  prices?: [number, number][];
}

const CACHE_TTL_MS = 60_000;
const FETCH_TIMEOUT_MS = 3_000;

/**
 * Real, live BTC market data from CoinGecko's free public API (no key
 * required) — shown on the homepage as a genuine market reference, not
 * fabricated. Never throws: a fetch failure or CoinGecko being unreachable
 * just means the homepage renders without that card rather than 500ing the
 * whole page for something cosmetic. Cached in-memory for a minute so the
 * homepage being popular doesn't turn into hammering a free third-party API.
 */
@Injectable()
export class BitcoinPriceService {
  private readonly logger = new Logger(BitcoinPriceService.name);
  private cached: { value: BitcoinPrice; expiresAt: number } | null = null;

  async getPrice(): Promise<BitcoinPrice | null> {
    if (this.cached && this.cached.expiresAt > Date.now()) {
      return this.cached.value;
    }

    try {
      const [simple, chart] = await Promise.all([
        this.fetchJson<CoinGeckoSimplePriceResponse>(
          'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true',
        ),
        this.fetchJson<CoinGeckoMarketChartResponse>(
          'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=7&interval=daily',
        ),
      ]);

      const priceUsd = simple.bitcoin?.usd;
      const change24hPct = simple.bitcoin?.usd_24h_change;
      const sparkline7d: number[] =
        chart.prices?.map((point) => point[1]) ?? [];

      if (typeof priceUsd !== 'number' || typeof change24hPct !== 'number') {
        return null;
      }

      const value: BitcoinPrice = { priceUsd, change24hPct, sparkline7d };
      this.cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
      return value;
    } catch (err) {
      this.logger.warn(`Bitcoin price fetch failed: ${(err as Error).message}`);
      return this.cached?.value ?? null;
    }
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}
