import * as R from 'ramda'
import { camelCase } from 'lodash'
import path from 'path'
import fs from 'fs-extra'
import { ISchema, Schema } from '@formily/react-schema-renderer'
import { IPackageJson } from '../types/common'
import { IWeAppComponentInstance, toCssStyle } from '../../weapps-core'
import { ICompositedComponent, IMaterialItem } from '../../weapps-core/types/material'
import { pullComponentToListByInstance } from '../service/builder/generate'
import os from 'os'
const homeDir = os.homedir()
const commandConfigPath = path.join(homeDir, '.warc')

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
  if (!sourceKey) {
    return {}
  }
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
  } catch (e) { }
}

export function getSelfPackageJson(): IPackageJson | undefined {
  try {
    return fs.readJSONSync(path.resolve(__dirname, '../../package.json'))
  } catch (e) { }
}

export function JsonToStringWithVariableName(copyJson: any): string {
  return JSON.stringify(copyJson, null, 2).replace(/("%%%|%%%"|\\n)/g, '')
}

export function deepDealSchema(
  sourceSchema: ISchema,
  deal: (schema: Schema, key: string) => void
): ISchema {
  const fieldSchema = new Schema(sourceSchema)
  if (fieldSchema && fieldSchema.isObject()) {
    let properties = fieldSchema.properties || {}
    for (let key in properties) {
      const schema = properties[key]
      const { 'x-props': xProps } = schema
      if (xProps && xProps['data'] && xProps['data']._visible === false) {
        // 暂时不知道 fieldSchema.properties.key 如何删除，暂时使用空Schema替换
        fieldSchema.setProperty(key, new Schema({}))
      } else {
        deepDealSchema(schema, deal)
        deal && deal(schema, key)
      }
    }
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


export async function getInputProps(appBuildDir: string, dependencies: IMaterialItem[]) {
  const outputObj = {}
  await Promise.all(
    dependencies.map(async ({ name: materialName, version, components, isComposite }) => {
      if (isComposite) {
        components.forEach((component) => {
          let compItem = component as ICompositedComponent
          const sourceKey = `${materialName}:${compItem.name}`
          Object.keys(compItem.dataForm || {}).forEach(key => {
            const inputProps =
              compItem.dataForm[key]?.inputProp || compItem.dataForm[key]?.syncProps
            if (inputProps) {
              outputObj[sourceKey] = {
                [key]: inputProps,
                ...(outputObj[sourceKey] || {}),
              }
            }
          })
        })
      } else {
        const materialComponentsPath = path
          .resolve(appBuildDir, `libraries/${materialName}@${version}/components`)
          .replace(/packages\/\w+\//, '') // HACK：去除子包的目录，找根目录的素材地址。后续提供一个方法获取这些关键路径。
        const components = await fs.readdir(materialComponentsPath)

        await Promise.all(
          components.map(async name => {
            const componentMetaPath = `${materialComponentsPath}/${name}/meta.json`
            const sourceKey = `${materialName}:${name}`
            const metaJson = await fs.readJson(componentMetaPath)
            const inputProps = metaJson.inputProps || metaJson.syncProps
            if (inputProps) {
              outputObj[sourceKey] = inputProps
            }
          })
        )
      }
    })
  )
  return outputObj
}

export async function getYyptConfigInfo(extraData: any) {
  let configJson
  try {
    configJson = await fs.readJSON(commandConfigPath)
  } catch (e) { }
  configJson = configJson || {
    yyptAppKey: '',
    reportUrl: '',
    stopReport: false,
  }
  if (!extraData || !extraData.operationService) {
    extraData = extraData || {}
    extraData.operationService = extraData.operationService || {}
  }

  const yyptAppKey = extraData.operationService.extAppId || configJson.yyptAppKey || ''
  const reportUrl = extraData.operationService.reportUrl || configJson.reportUrl || ''
  const yyptEnabled = extraData.operationService.yyptEnabled
  let stopReport = false
  if (typeof yyptEnabled === 'boolean') {
    stopReport = !yyptEnabled
  } else {
    stopReport = configJson.stopReport === 'true'
  }

  return {
    yyptAppKey,
    reportUrl,
    stopReport,
  }
}
