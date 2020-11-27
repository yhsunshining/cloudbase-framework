import { toDash } from './util'
/**
 * Convert HtmlElement.style object to css declarations
 */
export function styleToCss(style) {
  const styleDeclars: string[] = [] // ['color: red;', 'background-color: green']
  for (const key in style) {
    styleDeclars.push(toDash(key) + ':' + style[key])
  }
  return styleDeclars.join(';')
}
