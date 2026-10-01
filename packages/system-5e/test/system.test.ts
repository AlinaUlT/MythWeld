import { systemIdSchema } from '@grimoire/schema';
import { describe, expect, it } from 'vitest';
import { FIFTH_EDITION_SYSTEM } from '../src/index.ts';

describe('ENG-31 the fifth-edition module', () => {
  it('names its system 5e, an id the core accepts', () => {
    expect(FIFTH_EDITION_SYSTEM).toBe('5e');
    expect(systemIdSchema.safeParse(FIFTH_EDITION_SYSTEM).success).toBe(true);
  });
});
