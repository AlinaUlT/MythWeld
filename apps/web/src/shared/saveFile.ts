// SHEET-25: a file the app makes is saved by the browser's own download, from memory; nothing is
// sent anywhere (SPEC §11).

/** Hands `text` to the browser to save as `fileName`, of the media type `type`. */
export function saveFile(fileName: string, text: string, type: string, doc: Document = document) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = doc.createElement('a');
  link.href = url;
  link.download = fileName;
  link.hidden = true;
  doc.body.append(link);
  link.click();
  link.remove();
  // The browser has read the file once the click is handled; the next task frees it.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
