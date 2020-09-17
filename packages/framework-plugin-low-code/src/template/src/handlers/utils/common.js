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
 * All data bindings are generated as functions: (forItems) => any
 * @param {*} dataBinds
 * @param {*} forItems
 */
export function resolveDataBinds(dataBinds, forItems) {
  const resolvedProps = {}
  for (const prop in dataBinds) {
    try {
      resolvedProps[prop] = dataBinds[prop](forItems)
    } catch (e) {
      console.error('Error resolving data binding', prop, dataBinds[prop], e)
    }
  }
  return resolvedProps
}

export function deepDealSchema(sourceSchema, deal) {
  const fieldSchema = new Schema(sourceSchema)
  fieldSchema.mapProperties((schema, key) => {
    deepDealSchema(schema, deal)
    deal && deal(schema, key)
  })
  return fieldSchema.toJSON()
}
