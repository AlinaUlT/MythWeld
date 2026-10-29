// SHEET-25: a file the app hands the person to save, made on the device; nothing leaves it.

/** Saves `text` as the file `name` through the browser's own download. */
export function downloadFile(name: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  // The click has started the download; the address is no longer needed.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
