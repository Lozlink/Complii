// Simple currency conversion utility
// In production, integrate with actual currency API (e.g., exchangerate-api.com)

const EXCHANGE_RATES: Record<string, Record<string, number>> = {
  AUD: {
    USD: 0.65,
    EUR: 0.60,
    GBP: 0.52,
    NZD: 1.08,
    SGD: 0.87,
    AUD: 1.0,
  },
  USD: {
    AUD: 1.54,
    EUR: 0.92,
    GBP: 0.80,
    NZD: 1.67,
    SGD: 1.34,
    USD: 1.0,
  },
  EUR: {
    AUD: 1.67,
    USD: 1.09,
    GBP: 0.87,
    NZD: 1.81,
    SGD: 1.45,
    EUR: 1.0,
  },
  GBP: {
    AUD: 1.92,
    USD: 1.25,
    EUR: 1.15,
    NZD: 2.08,
    SGD: 1.67,
    GBP: 1.0,
  },
  NZD: {
    AUD: 0.93,
    USD: 0.60,
    EUR: 0.55,
    GBP: 0.48,
    SGD: 0.81,
    NZD: 1.0,
  },
  SGD: {
    AUD: 1.15,
    USD: 0.75,
    EUR: 0.69,
    GBP: 0.60,
    NZD: 1.24,
    SGD: 1.0,
  },
};

export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): number {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();

  if (!EXCHANGE_RATES[from]) {
    throw new Error(`Unsupported currency: ${fromCurrency}`);
  }

  const rate = EXCHANGE_RATES[from][to];
  if (!rate) {
    throw new Error(`Cannot convert ${fromCurrency} to ${toCurrency}`);
  }

  return Math.round(amount * rate * 100) / 100;
}

export function getSupportedCurrencies(): string[] {
  return Object.keys(EXCHANGE_RATES);
}

export function getExchangeRate(
  fromCurrency: string,
  toCurrency: string
): number {
  if (fromCurrency === toCurrency) {
    return 1.0;
  }

  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();

  if (!EXCHANGE_RATES[from]) {
    throw new Error(`Unsupported currency: ${fromCurrency}`);
  }

  const rate = EXCHANGE_RATES[from][to];
  if (!rate) {
    throw new Error(`Cannot get rate for ${fromCurrency} to ${toCurrency}`);
  }

  return rate;
}
