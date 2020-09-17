import { KEBAB_REGEX } from '../config'
import { BindPropertyPath, IDataBind } from '../types'

export function loopDealWithFn<Node extends { children?: Node[] }, R>(
  data: Node[],
  runFn: (a: Node) => R,
  result: R[] = []
) {
  data.map(item => {
    if (item.children) {
      loopDealWithFn(item.children, runFn, result)
    }
    result.push(runFn(item))
  })
  return result
}

export function kebabCase(str: string) {
  return str.replace(KEBAB_REGEX, function(match) {
    return '-' + match.toLowerCase()
  })
}

export function camelcase(str: string, firstUpperCase = false) {
  str = str.replace(/[_-]([a-z])/g, function(l) {
    return l[1].toUpperCase()
  })

  if (firstUpperCase) str = str.charAt(0).toUpperCase() + str.slice(1)

  return str
}

export function isArray(src: any) {
  return Object.prototype.toString.call(src) === '[object Array]'
}

export function isPlainObject(src: any) {
  return Object.prototype.toString.call(src) === '[object Object]'
}

export const isEmptyObj = (obj: object) => {
  if (!isPlainObject(obj)) {
    return false
  }
  for (const i in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, i)) {
      return false
    }
  }
  return true
}

export function setValidValue(target, key, value) {
  if (value === undefined || value === null) {
    return
  }
  if (isArray(value) && value.length === 0) {
    return
  }
  if (isPlainObject(value) && isEmptyObj(value)) {
    return
  }
  if (!target) {
    return
  }
  target[key] = value
}

export function isValidStyleBind(styleBind: IDataBind) {
  if (!styleBind) {
    return false
  }
  if (styleBind.propertyPath === BindPropertyPath.style) {
    return true
  }
  return false
}

export function isValidClassNameListBind(classNameListBind: IDataBind) {
  if (!classNameListBind) {
    return false
  }
  if (classNameListBind.propertyPath === BindPropertyPath.classNameList) {
    return true
  }
  return false
}
