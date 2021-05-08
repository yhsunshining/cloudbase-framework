
import { kebabCase, camelcase, isEmptyObj } from './common'

const PERCENTAGE_KEY_LIST = [
  'opacity',
  'order',
  'flex',
  'flexGrow',
  'flexShrink',
  'zIndex',
  'fontWeight',
  'borderImage',
]

export function translateStyleToRem(style) {
  return translateStyleByHandler(style, toREM)
}

export function translateStyleByHandler(style, handler) {
  return Object.keys(style).reduce((result, key) => {
    const value = style[key]
    if (PERCENTAGE_KEY_LIST.includes(key)) {
      setStyleValue(result, key, value)
    } else if (value !== undefined && value !== null) {
      setStyleValue(result, key, handler(value))
    }
    return result
  }, {})
}

function setStyleValue(object, key, value) {
  if (value === undefined || value === null || value === '') {
    return
  }
  // 特殊样式移除
  if (key === 'open') {
    return
  }

  if (isEmptyObj(value)) {
    return
  }

  object[camelcase(key)] = value
}

function calPxToREM(px) {
  if (Number.isNaN(px / 28)) return px.toString()
  if (+px === 0) {
    return '0'
  }
  return (px / 28).toFixed(4) + 'rem'
}

export function toREM(cssLen) {
  if (typeof cssLen === 'string') {
    const cssLenArr = cssLen.split(' ')
    return cssLenArr
      .map(attr => {
        const matchResult = attr.match(/^(-?\d+)(px)?$/)
        if (matchResult && matchResult[1]) {
          return calPxToREM(+matchResult[1])
        }
        return attr
      })
      .join(' ')
  }

  if (typeof cssLen === 'number') {
    return calPxToREM(cssLen)
  }
}

export function toCssText(style, className = '.some-class-name') {
  const attrText = Object.keys(style)
    .map(key => {
      const value = style[key]
      return `${kebabCase(key)}: ${value};`
    })
    .join('\n')
  return `${className} { ${attrText} }\n`
}
