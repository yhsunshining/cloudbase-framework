/**
 * Convert abcWordSnd -> abc-word-snd
 */
export function toDash(str: string) {
  return str.replace(/[A-Z]/g, upperLetter => `-${upperLetter.toLowerCase()}`)
}
