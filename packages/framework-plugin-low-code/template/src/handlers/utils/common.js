import { Schema } from '@formily/react-schema-renderer'

export function getComponentId(key) {
  return `__weapps-component-wrapper-${key}`
}

export const pathSpecialSymbol = '__$__'

export function pathTransformDotToSymbol(str) {
  return str.replace(/\./g, pathSpecialSymbol)
}

export function pathTransformSymbolToDot(str) {
  return String(str).replace(new RegExp(`__\\$__`, 'g'), '.')
}

/**
 * All data bindings are generated as functions: (forItems, event?) => any
 * @param {*} dataBinds
 * @param {*} forItems
 */
export function resolveDataBinds(dataBinds, forItems, codeContext, throwError) {
  const resolvedProps = {}
  for (const prop in dataBinds) {
    let fn = dataBinds[prop]
    try {
      if (codeContext && codeContext.$WEAPPS_COMP) {
        fn = fn.bind(codeContext.$WEAPPS_COMP)
      }
      resolvedProps[prop] = fn(forItems, codeContext && codeContext.event)
    } catch (e) {
      console.error('Error resolving data binding', prop, dataBinds[prop], e)
      if (throwError) {
        throw e
      }
    }
  }
  return resolvedProps
}

export function deepDealSchema(sourceSchema, deal) {
  const fieldSchema = new Schema(sourceSchema)
  Object.keys(fieldSchema.properties).forEach((key) => {
    const schema = fieldSchema.properties[key]
    deepDealSchema(schema, deal)
    deal && deal(schema, key)
  })
  return fieldSchema.toJSON()
}

const varSeparator = '.'
export function getDeep(target, key) {
  if (key == null) {
    return target
  }
  const keys = (key + '').split(varSeparator)
  let prop = target[keys[0]]
  for (let i = 1; i < keys.length; i++) {
    prop = prop[keys[i]]
  }
  return prop
}

/**
 * 用于处理自定义组件props传参结构，对系统变量进行保留
 */
export function resolveComponentProps(props) {
  let { data = {}, events = [], ...restProps } = props
  const customProps = { ...data }

  const builtinProps = [
    // react 保留字
    'ref',
    'key',
    'dangerouslySetInnerHTML',
    'className',
    'htmlFor',
    'style',
    'contentEditable',
    // lowcode 保留字
    'events',
    'children',
    '_parentId',
    '_visible',
    'classList',
    'widgetType',
    'getWidgetsByType',
    'getDom',
    'domRef',
    'extends',
    // 小程序保留字
    'id',
    'class',
    'hidden',
    'slot',
  ]
  // delete builtin props
  builtinProps.map((prop) => delete customProps[prop])

  return {
    ...data,
    ...restProps,
    events: events.reduce((events, item) => {
      const propName = item
      events[propName] = (e) => restProps.emit(propName, e)
      return events
    }, {}),
  }
}
