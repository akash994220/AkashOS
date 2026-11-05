/**
 * Currency conversion utility with 12-24h client caching and graceful fallback.
 * Base currency is always BDT.
 */

export interface ExchangeRatesData {
  base: string;
  rates: Record<string, number>;
  timestamp: number;
}

const CACHE_KEY = 'app_exchange_rates_cache_v1';
const CACHE_TTL_MS = 18 * 60 * 60 * 1000; // 18 hours (within 12-24 hour mandate)

export const AVAILABLE_CURRENCIES: { code: string; name: string; symbol: string }[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'AED' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'SAR' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
];

let memoryRatesCache: ExchangeRatesData | null = null;

export async function fetchExchangeRates(): Promise<ExchangeRatesData | null> {
  // Check memory cache first
  if (memoryRatesCache && Date.now() - memoryRatesCache.timestamp < CACHE_TTL_MS) {
    return memoryRatesCache;
  }

  // Check localStorage cache
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ExchangeRatesData;
      if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
        memoryRatesCache = parsed;
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Could not read cached exchange rates:', e);
  }

  // Fetch from free open endpoint
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/BDT', {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    if (data && data.rates) {
      const cachePayload: ExchangeRatesData = {
        base: 'BDT',
        rates: data.rates,
        timestamp: Date.now(),
      };
      memoryRatesCache = cachePayload;
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(cachePayload));
      } catch (err) {
        // LocalStorage quota might be full or disabled; proceed with memory cache
      }
      return cachePayload;
    }
  } catch (err) {
    // If fetch fails, silently fall back to showing BDT-only for that session
    console.warn('Exchange rates fetch failed, falling back to BDT-only:', err);
  }

  return memoryRatesCache; // Return cached data even if slightly expired, or null
}

export function formatBDT(amount: number): string {
  return `৳${Number(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function convertFromBDT(
  amountBdt: number,
  targetCurrency: string,
  rates: Record<string, number> | null | undefined
): { formatted: string; value: number } | null {
  if (!rates || !rates[targetCurrency] || isNaN(amountBdt)) {
    return null;
  }

  const rate = rates[targetCurrency];
  const converted = amountBdt * rate;
  const currencyInfo = AVAILABLE_CURRENCIES.find((c) => c.code === targetCurrency);
  const symbol = currencyInfo?.symbol || targetCurrency;

  const formatted = `${symbol}${converted.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  return { formatted, value: converted };
}

export function formatMultiCurrency(
  amountBdt: number,
  selectedCurrencies: string[],
  rates: Record<string, number> | null | undefined
): string {
  if (!selectedCurrencies || selectedCurrencies.length === 0 || !rates) {
    return '';
  }

  const conversions: string[] = [];
  for (const curr of selectedCurrencies) {
    const conv = convertFromBDT(amountBdt, curr, rates);
    if (conv) {
      conversions.push(conv.formatted);
    }
  }

  if (conversions.length === 0) return '';
  return `(${conversions.join(' • ')})`;
}
