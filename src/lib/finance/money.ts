export const SUPPORTED_CURRENCIES = ["INR", "USD"] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export interface RationalRate {
  numerator: bigint;
  denominator: bigint;
}

export interface Money {
  amountInMinorUnits: bigint;
  currency: SupportedCurrency;
}

export const INR_RATE: RationalRate = { numerator: 1n, denominator: 1n };
export const USD_TO_INR_RATE: RationalRate = { numerator: 83n, denominator: 1n };

export function assertIntegerMinorUnits(value: number): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error("Money values must be safe integers in minor units.");
  }
}

export function divideWithRemainder(
  total: bigint,
  participantIds: readonly string[],
): ReadonlyMap<string, bigint> {
  if (total < 0n) {
    throw new Error("Cannot split a negative total.");
  }
  if (participantIds.length === 0) {
    throw new Error("At least one participant is required.");
  }

  const divisor = BigInt(participantIds.length);
  const baseShare = total / divisor;
  let remainder = total % divisor;
  const shares = new Map<string, bigint>();

  for (const participantId of participantIds) {
    const extra = remainder > 0n ? 1n : 0n;
    shares.set(participantId, baseShare + extra);
    remainder -= extra;
  }

  return shares;
}

export function convertMinorUnits(
  amount: bigint,
  rate: RationalRate,
): bigint {
  if (rate.numerator <= 0n || rate.denominator <= 0n) {
    throw new Error("Exchange rates must be positive.");
  }

  const scaled = amount * rate.numerator;
  const quotient = scaled / rate.denominator;
  const remainder = scaled % rate.denominator;

  // Financial conversions use deterministic half-away-from-zero rounding.
  if (remainder * 2n >= rate.denominator) {
    return quotient + 1n;
  }
  if (remainder * 2n <= -rate.denominator) {
    return quotient - 1n;
  }
  return quotient;
}

export function parseDecimalRate(value: string): RationalRate {
  const normalized = value.trim();
  const match = /^(0|[1-9]\d*)(?:\.(\d+))?$/.exec(normalized);
  if (!match) {
    throw new Error(`Invalid positive exchange rate: ${value}`);
  }

  const fraction = match[2] ?? "";
  return {
    numerator: BigInt(`${match[1]}${fraction}`),
    denominator: 10n ** BigInt(fraction.length),
  };
}

export function toDatabaseInt(value: bigint): number {
  const asNumber = Number(value);
  assertIntegerMinorUnits(asNumber);
  if (asNumber < -2_147_483_648 || asNumber > 2_147_483_647) {
    throw new Error("Amount exceeds the PostgreSQL INTEGER range.");
  }
  return asNumber;
}
