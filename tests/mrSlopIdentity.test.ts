import { describe, expect, it } from 'vitest';
import { MR_SLOP_BASE_SHELL } from '../prompts/mrSlopBase';

describe('Mr. Slop identity shell', () => {
  it('uses the active Mr. Slop prompt shell instead of legacy Ghost identity', () => {
    expect(MR_SLOP_BASE_SHELL).toContain('Mr. Slop');
    expect(MR_SLOP_BASE_SHELL).toContain('Conversation is the primary interface');
    expect(MR_SLOP_BASE_SHELL).not.toContain('GHOST_FRAGMENT');
    expect(MR_SLOP_BASE_SHELL).not.toContain('The Ghost');
  });
});
