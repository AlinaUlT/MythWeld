import * as engine from '@grimoire/engine';
import { describe, expect, it } from 'vitest';

describe('SETUP-02 engine smoke', () => {
  it('imports the engine package', () => {
    expect(engine).toBeTypeOf('object');
  });
});
