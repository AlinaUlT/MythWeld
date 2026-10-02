import { fifthEditionPackJsonSchema } from '@grimoire/system-5e';
import { describe, expect, it } from 'vitest';

// ENG-38: the app publishes each system's pack JSON Schema as a file (SPEC §5.7), one folder per
// system id. This test keeps the committed file equal to the module's schemas. In CI it only
// compares; after a schema change, run it with `--update` to rewrite the file (docs/RUNNING.md).

describe('ENG-38 published pack schema', () => {
  it('is the fifth-edition pack JSON Schema, in public/schema/5e/pack.schema.json', async () => {
    const text = `${JSON.stringify(fifthEditionPackJsonSchema(), null, 2)}\n`;
    await expect(text).toMatchFileSnapshot('../public/schema/5e/pack.schema.json');
  });
});
