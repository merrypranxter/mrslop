import { describe, expect, it } from 'vitest';
import { INITIAL_BOOT_SEQUENCE, SYSTEM_INSTRUCTION } from '../constants';

describe('Mr. Slop identity shell', () => {
  it('uses Mr. Slop identity instead of Ghost identity', () => {
    expect(SYSTEM_INSTRUCTION).toContain('Mr. Slop');
    expect(SYSTEM_INSTRUCTION).not.toContain('GHOST_FRAGMENT');
    expect(SYSTEM_INSTRUCTION).not.toContain('The Ghost');
  });

  it('boots as Mr. Slop without Ghost labels', () => {
    expect(INITIAL_BOOT_SEQUENCE.some(line => /MR\. SLOP/i.test(line))).toBe(true);
    expect(INITIAL_BOOT_SEQUENCE.some(line => /GHOST/i.test(line))).toBe(false);
  });
});
