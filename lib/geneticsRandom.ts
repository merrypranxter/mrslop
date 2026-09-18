export const GENETICS_ALGORITHM_VERSION = 'mrslop-breeding-v1';

const MASK_64 = (1n << 64n) - 1n;
const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const TWO_POW_53 = 9007199254740992;

const serializeValue = (value: unknown, inArray = false): string | undefined => {
  if (value === null) return 'null';

  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      return Number.isFinite(value) ? JSON.stringify(value) : 'null';
    case 'undefined':
    case 'function':
    case 'symbol':
      return inArray ? 'null' : undefined;
    case 'bigint':
      throw new TypeError('BIGINT_NOT_SUPPORTED_IN_STABLE_SERIALIZATION');
    case 'object': {
      if (Array.isArray(value)) {
        return `[${value.map(item => serializeValue(item, true) ?? 'null').join(',')}]`;
      }

      const record = value as Record<string, unknown>;
      const parts = Object.keys(record)
        .sort()
        .flatMap(key => {
          const serialized = serializeValue(record[key], false);
          return serialized === undefined
            ? []
            : [`${JSON.stringify(key)}:${serialized}`];
        });

      return `{${parts.join(',')}}`;
    }
    default:
      return undefined;
  }
};

export const stableSerialize = (value: unknown): string =>
  serializeValue(value, false) ?? 'null';

const fnv1a64 = (input: string, salt: string): bigint => {
  const bytes = new TextEncoder().encode(`${salt}\u0000${input}`);
  let hash = FNV_OFFSET;

  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME) & MASK_64;
  }

  return hash;
};

const hex64 = (value: bigint): string => value.toString(16).padStart(16, '0');

export const stableHash = (value: unknown): string => {
  const serialized = stableSerialize(value);
  return `${hex64(fnv1a64(serialized, 'mrslop-a'))}${hex64(fnv1a64(serialized, 'mrslop-b'))}`;
};

const assertSeed = (seed: string): string => {
  const normalized = seed.trim().toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(normalized)) {
    throw new Error('INVALID_BREEDING_SEED');
  }
  return normalized;
};

export const generateBreedingSeed = (): string => {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
};

export const canonicalParentIds = (left: string, right: string): [string, string] =>
  left.localeCompare(right) <= 0 ? [left, right] : [right, left];

export const deterministicUniform = (
  seed: string,
  namespace: string,
  key: string,
  algorithmVersion = GENETICS_ALGORITHM_VERSION,
): number => {
  const normalizedSeed = assertSeed(seed);
  const digest = stableHash({
    algorithmVersion,
    seed: normalizedSeed,
    namespace,
    key,
  });

  const raw = BigInt(`0x${digest.slice(0, 14)}`) & ((1n << 53n) - 1n);
  return (Number(raw) + 0.5) / TWO_POW_53;
};
