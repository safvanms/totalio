/**
 * Money helpers. Amounts are stored as major units rounded to 2 decimals;
 * every aggregation is performed in integer minor units to avoid
 * floating-point drift (the 0.1 + 0.2 problem).
 */

export const MAX_AMOUNT = 10_000_000_000; // 10 billion per entry

export function toMinor(amount: number): number {
  return Math.round(amount * 100);
}

export function fromMinor(minor: number): number {
  return minor / 100;
}

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** Accurate sum of money values. */
export function sumMoney(values: Iterable<number>): number {
  let minor = 0;
  for (const v of values) minor += toMinor(v);
  return fromMinor(minor);
}

export interface CurrencyDef {
  code: string;
  symbol: string;
  name: string;
  locale: string;
}

export const CURRENCIES: CurrencyDef[] = [
  { code: "INR", symbol: "₹", name: "Indian Rupee", locale: "en-IN" },
  { code: "USD", symbol: "$", name: "US Dollar", locale: "en-US" },
  { code: "EUR", symbol: "€", name: "Euro", locale: "de-DE" },
  { code: "GBP", symbol: "£", name: "British Pound", locale: "en-GB" },
  { code: "AED", symbol: "AED", name: "UAE Dirham", locale: "en-AE" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", locale: "ja-JP" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", locale: "en-AU" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar", locale: "en-CA" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", locale: "en-SG" },
];

export function getCurrency(code: string): CurrencyDef {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}

const fmtCache = new Map<string, Intl.NumberFormat>();
function formatter(code: string, compact: boolean) {
  const key = `${code}|${compact}`;
  let f = fmtCache.get(key);
  if (!f) {
    const c = getCurrency(code);
    f = new Intl.NumberFormat(c.locale, {
      style: "currency",
      currency: c.code,
      notation: compact ? "compact" : "standard",
      maximumFractionDigits: compact ? 1 : 2,
      minimumFractionDigits: 0,
    });
    fmtCache.set(key, f);
  }
  return f;
}

export function formatMoney(amount: number | null | undefined, currency = "INR", opts: { compact?: boolean } = {}): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return "—";
  return formatter(currency, !!opts.compact).format(amount);
}
