import * as R from 'ramda'
import { camelCase } from 'lodash'
import path from 'path'
import fs from 'fs-extra'
import { ISchema, Schema } from '@formily/react-schema-renderer'
import { IPackageJson } from '../types/common'

export type PromiseResult<T> = Promise<[null, T] | [Error, null]>
export function promiseWrapper<T>(p: Promise<T>): PromiseResult<T> {
  return new Promise(resolve => {
    try {
      p.then(i => resolve([null, i as T])).catch(e => resolve([e, null]))
    } catch (e) {
      resolve([e, null])
    }
  })
}

export function getMetaInfoBySourceKey(sourceKey: string) {
  const [materialName, name] = sourceKey.split(':')
  return {
    materialName,
    name,
    variableName: camelCase(materialName + '_' + name),
  }
}

export function isArray(src: any) {
  return Object.prototype.toString.call(src) === '[object Array]'
}

export function isPlainObject(src: any) {
  return Object.prototype.toString.call(src) === '[object Object]'
}

export function isEmpty(i: any): boolean {
  if (typeof i === 'string') return !i.trim()
  return R.isEmpty(i) || R.isNil(i) || Number.isNaN(i)
}

export function deepDeal(src: any, reviver: (key: any, value: any, parent: any) => void) {
  // 对于 数组
  if (isArray(src)) {
    for (let i = 0, len = src.length; i < len; i++) {
      deepDeal(src[i], reviver)
      reviver && reviver(i, src[i], src)
    }
  }

  // 对于 Object
  if (isPlainObject(src)) {
    for (const key in src) {
      if (src.hasOwnProperty(key)) {
        // 忽略掉继承属性
        deepDeal(src[key], reviver)
        reviver && reviver(key, src[key], src)
      }
    }
  }
}

export function simpleDeepClone<T>(data: any): T {
  return JSON.parse(JSON.stringify(data))
}

export function getCurrentPackageJson() {
  try {
    const { name, version } = fs.readJSONSync(path.resolve(process.cwd(), 'package.json'))
    return {
      name,
      version,
    }
  } catch (e) {}
}

export function getSelfPackageJson(): IPackageJson {
  try {
    return fs.readJSONSync(path.resolve(__dirname, '../../package.json'))
  } catch (e) {}
}

export function JsonToStringWithVariableName(copyJson: any): string {
  return JSON.stringify(copyJson, null, 2).replace(/("%%%|%%%")/g, '')
}

export function deepDealSchema(
  sourceSchema: ISchema,
  deal: (schema: Schema, key: string) => void
): ISchema {
  const fieldSchema = new Schema(sourceSchema)
  if (fieldSchema && fieldSchema.isObject()) {
    fieldSchema.mapProperties((schema, key) => {
      const { 'x-props': xProps } = schema
      if (xProps && xProps['data'] && xProps['data']._visible === false) {
        // 暂时不知道 fieldSchema.properties.key 如何删除，暂时使用空Schema替换
        fieldSchema.setProperty(key, new Schema({}))
      } else {
        deepDealSchema(schema, deal)
        deal && deal(schema, key)
      }
    })
  }
  return fieldSchema.toJSON()
}

export function requireUncached(module) {
  delete require.cache[require.resolve(module)]
  return require(module)
}

export function removeRequireUncached(path = '') {
  if (fs.existsSync(path)) {
    delete require.cache[require.resolve(path)]
  }
}
