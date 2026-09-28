// Asks the browser not to clear this site's storage on its own (SPEC §11). It is asked on every
// start until it is granted: Chrome decides without a prompt, and says yes more readily once the
// app is installed, so a "no" on the first start is not final.
export type PersistResult = 'granted' | 'denied' | 'unsupported';

type PersistApi = Pick<StorageManager, 'persist' | 'persisted'>;

export async function requestPersistentStorage(
  storage: Partial<PersistApi> | undefined = globalThis.navigator?.storage,
): Promise<PersistResult> {
  if (!storage?.persist || !storage.persisted) return 'unsupported';
  if (await storage.persisted()) return 'granted';
  return (await storage.persist()) ? 'granted' : 'denied';
}
