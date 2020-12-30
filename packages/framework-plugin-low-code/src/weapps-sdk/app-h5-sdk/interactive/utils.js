export function getDocument() {
  if (window.previewWindow && window.previewWindow.document) {
    return window.previewWindow.document
  }
  return document
}
