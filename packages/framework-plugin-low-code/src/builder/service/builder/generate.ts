import path from 'path'
import fs from 'fs-extra'
import _ from 'lodash'
import tpl from 'lodash.template'
import { Schema, ISchema } from '@formily/react-schema-renderer'
import chalk from 'chalk'
import os from 'os'
import {
  IMaterialItem,
  IPageInstance,
  IListenerInstance,
  toCssStyle,
  IComponentSchemaJson,
  IPluginInstance,
  ActionType,
  IItemInstance,
  IComponentInstanceProps,
  IWebRuntimeAppData,
  IWeAppCode,
  getCodeModuleFilePath,
  loopDealWithFn,
  toCssText,
  isEmptyObj,
  IDataBind,
  PropBindType,
  IComponentMeta,
  getCompositedComponentClass,
  ICompositedComponent,
  IWeAppData,
} from '../../../weapps-core'
import {
  deepDealSchema,
  getInputProps,
  getMetaInfoBySourceKey,
  JsonToStringWithVariableName,
  simpleDeepClone,
} from '../../util'
import { REPLACE_SIGN, appTemplateDir } from '../../config'
import {
  processLess,
  generateDefaultTheme,
  generateDefaultStyle,
  defaultThemeCode,
} from '../../util/style'
import { buildAsWebByBuildType, IComponentInputProps } from '../../types/common'
import { getYyptConfigInfo } from '../../util'

import {
  getDatasourceProfiles,
  getDataVarProfiles,
  getDatasetProfiles,
} from '../../../utils/dataSource'
import { DEPLOY_MODE } from '../../../index'

export interface IOriginKeyInfo {
  sourceKey: string
  name: string
  materialName: string
  materialVersion: string
  key: string
  variableName: string
  type?: ActionType
}

export async function generateAppStyleLessFile(
  allAppDataList: IWebRuntimeAppData[],
  appBuildDir: string
) {
  const appLessPath = path.join(appBuildDir, 'src/index.less')
  await fs.ensureFile(appLessPath)
  for (const appData of allAppDataList) {
    if (appData.codeModules) {
      // 兼容 'app-style'
      const content = `@import "./lowcode/style.less";`
      await fs.writeFile(appLessPath, `${content}${os.EOL}`, {
        encoding: 'utf8',
      })
    }
  }
  // const appLessContent = await fs.readFile(appLessPath, {
  //   encoding: 'utf8',
  // })
  // console.log(appLessPath, '<<<<<<<<<<<< generateAppStyleLessFile')
  // const remCss = await processLess(appLessContent)
  // await fs.writeFile(appLessPath, remCss, {
  //   encoding: 'utf8',
  // })
}

export async function generateThemeVarsFile(
  themeVars: object = {},
  appBuildDir: string
) {
  const themeVarsPath = path.resolve(appBuildDir, './webpack/themeVars.js')

  // 清除没有的变量
  for (const key in themeVars) {
    if (!themeVars[key]) {
      delete themeVars[key]
    }
  }
  await fs.writeFile(
    themeVarsPath,
    `module.exports = ${JSON.stringify(themeVars, null, 2)}`,
    {
      encoding: 'utf8',
    }
  )
}

export async function generateAllPageJsxFile(
  pageInstanceList: IPageInstance[],
  appBuildDir: string,
  dependencies: IMaterialItem[] = [],
  extraData: {
    isComposite: boolean
    compProps: any
  } = {
    isComposite: false,
    compProps: {},
  },
  buildTypeList: any[]
) {
  await Promise.all(
    loopDealWithFn(pageInstanceList, (pageInstance) =>
      generateSinglePageJsxFile(
        pageInstance,
        appBuildDir,
        dependencies,
        extraData,
        buildTypeList
      )
    )
  )
}

export async function generateSinglePageJsxFile(
  pageInstance: IPageInstance,
  appBuildDir: string,
  dependencies: IMaterialItem[] = [],
  extraData: {
    isComposite: boolean
    compProps: any
  } = {
    isComposite: false,
    compProps: {},
  },
  buildTypeList: any[]
) {
  const fixedDependencies = dependencies // getFixedDependencies(dependencies)
  const {
    componentSchemaJson,
    pluginInstances,
    listenerInstances: pageListenerInstances,
    style: PageStyle,
    data,
  } = pageInstance
  const {
    originComponentList,
    originActionList,
  } = getOriginComponentAndActionList(
    componentSchemaJson as IComponentSchemaJson,
    fixedDependencies
  )
  const componentInputProps = await getInputProps(appBuildDir, dependencies)

  const originPluginList = getOriginPluginList(pluginInstances, dependencies)
  pullActionToListByInstances(
    pageListenerInstances,
    originActionList,
    fixedDependencies
  )
  const componentImportStringArr = getComponentImportStringArr(
    originComponentList
  )
  const actionImportStringArr = getActionImportStringArr(originActionList)
  const pluginImportStringArr = getPluginImportStringArr(originPluginList)

  const { widgets, dataBinds, componentSchema } = getComponentSchemaString(
    componentSchemaJson as IComponentSchemaJson,
    false,
    componentInputProps
  )

  const templateData = {
    pageName: pageInstance.id,
    componentImports: componentImportStringArr.join(';\n'),
    pluginImports: pluginImportStringArr.join(';\n'),
    actionImports: actionImportStringArr.join(';\n'),
    pageListenerInstances: getListenersString(pageListenerInstances),
    virtualFields: getVirtualFieldsString(originComponentList),
    pluginInstances: getPluginInstancesString(pluginInstances),
    componentSchema,
    widgets,
    dataBinds,
    // 复合组件预览需要
    isComposite: extraData.isComposite,
    compProps: extraData.compProps,
    title: data.navigationBarTitleText || data.title || '',
  }

  const dest = path.resolve(appBuildDir, `./pages/${pageInstance.id}/index.jsx`)
  const template = await fs.readFile(
    path.resolve(appTemplateDir, './src/pages/app.tpl'),
    {
      encoding: 'utf8',
    }
  )
  const jsx = tpl(template)(templateData)
  await fs.ensureFile(dest)
  await fs.writeFile(dest, jsx)

  // 生成页面样式
  const pageStyleDest = path.resolve(
    appBuildDir,
    `./pages/${pageInstance.id}/index.less`
  )
  const pageStyleString = toCssText(
    toCssStyle(PageStyle),
    buildAsWebByBuildType(buildTypeList) ? 'body' : 'page'
  )
  const prefixStyleImport = `@import "../../lowcode/${pageInstance.id}/style.less";`
  await fs.ensureFile(pageStyleDest)
  await fs.writeFile(
    pageStyleDest,
    prefixStyleImport + os.EOL + pageStyleString
  )
}

export function getOriginComponentAndActionList(
  componentSchema: IComponentSchemaJson,
  fixedDependencies: IMaterialItem[],
  originComponentList: IOriginKeyInfo[] = [],
  originActionList: IOriginKeyInfo[] = []
) {
  const fieldSchema = new Schema(componentSchema)
  if (fieldSchema.isObject()) {
    const { 'x-props': xProps } = fieldSchema
    if (xProps) {
      const { listenerInstances, sourceKey } = xProps as IComponentInstanceProps
      pullComponentToListByInstance(
        sourceKey,
        originComponentList,
        fixedDependencies
      )
      pullActionToListByInstances(
        listenerInstances,
        originActionList,
        fixedDependencies
      )
    }

    if (fieldSchema.properties) {
      for (let key in fieldSchema.properties) {
        const schema = fieldSchema.properties[key]
        const schemaJson = (schema as unknown) as IComponentSchemaJson
        getOriginComponentAndActionList(
          schemaJson,
          fixedDependencies,
          originComponentList,
          originActionList
        )
      }
    }
  }

  return {
    originComponentList,
    originActionList,
  }
}

export function getOriginPluginList(
  pluginInstances: IPluginInstance[] = [],
  dependencies: IMaterialItem[] = [],
  originPluginList: IOriginKeyInfo[] = []
) {
  pluginInstances.map((instance: IPluginInstance) => {
    const { sourceKey } = instance
    const { materialName, name, variableName } = getMetaInfoBySourceKey(
      sourceKey
    )
    const pluginKey = `${materialName}_${name}`
    const isExist = originPluginList.find((item: any) => item.key === pluginKey)
    if (isExist) {
      return
    }

    originPluginList.push({
      sourceKey,
      name: name || '',
      materialName: materialName || '',
      materialVersion: dependencies.find((m) => m.name === materialName)
        ?.version as string,
      key: pluginKey,
      variableName: variableName || '',
    })
  })
  return originPluginList
}

export function pullActionToListByInstances(
  listenerInstances,
  originActionList,
  fixedDependencies: IMaterialItem[]
) {
  if (!listenerInstances || !listenerInstances.length) {
    return
  }
  listenerInstances.map((pageListenerInstance: IListenerInstance) => {
    const { sourceKey, type } = pageListenerInstance
    const { materialName, name, variableName } = getMetaInfoBySourceKey(
      sourceKey
    )
    const material = fixedDependencies.find((m) => m.name === materialName)
    const actionKey = `${materialName}_${name}`
    const isExistAction = originActionList.find(
      (item: IOriginKeyInfo) => item.key === actionKey
    )
    if (!isExistAction) {
      originActionList.push({
        name,
        materialName,
        materialVersion: material && material.version,
        key: actionKey,
        type,
        variableName,
      })
    }
  })
}

export function pullComponentToListByInstance(
  sourceKey: string,
  originComponentList: IOriginKeyInfo[],
  fixedDependencies: IMaterialItem[]
) {
  const { materialName, name, variableName } = getMetaInfoBySourceKey(sourceKey)
  const componentKey = `${materialName}_${name}`
  const isExistComponent = originComponentList.find(
    (item: IOriginKeyInfo) => item.key === componentKey
  )
  if (!isExistComponent) {
    const foundOne = fixedDependencies.find((m) => m.name === materialName)
    if (!foundOne) return
    originComponentList.push({
      sourceKey,
      name: name || '',
      materialName: materialName || '',
      materialVersion: foundOne.version,
      key: componentKey,
      variableName: variableName || '',
    })
  }
}

export function getVirtualFieldsString(components: IOriginKeyInfo[]) {
  const fields = components.reduce((result: any, component: IOriginKeyInfo) => {
    const { name, materialName, variableName } = component
    result[`${materialName}:${name}`] = `%%%(props) => <${_.upperFirst(
      variableName
    )} {...props} pageVirtualFields={virtualFields}/>%%%`
    return result
  }, {})
  return JSON.stringify(fields, null, 2).replace(/("%%%|%%%")/g, '')
}

export function isSlot(comp: Schema) {
  return comp.path && !comp['x-props']
}

function getChildrenId(properties = {}) {
  let childrenId: string[] = []

  for (const key in properties) {
    const comp = properties[key]
    if (isSlot(comp)) {
      childrenId = childrenId.concat(getChildrenId(comp.properties))
    } else {
      childrenId = childrenId.concat(key)
    }
  }

  return childrenId
}

export function getComponentSchemaString(
  componentSchema: IComponentSchemaJson,
  isComposite = false,
  componentInputProps: IComponentInputProps = {},
  wrapperClass?: string
) {
  const copyJson = simpleDeepClone<IComponentSchemaJson>(componentSchema)
  const compWidgets = {}
  const compDataBinds = {}
  const componentSchemaJson = deepDealSchema(copyJson, (schema) => {
    const { 'x-props': xProps = {}, properties } = schema
    const {
      dataBinds = [],
      commonStyle = {},
      data = {},
      classNameList = [],
      sourceKey,
      styleBind,
      classNameListBind,
    } = xProps

    // 生成 widgets/dataBinds
    if (!isSlot(schema) && schema.key) {
      compWidgets[schema.key] = {
        ...data,
        style: toCssStyle(commonStyle),
        classList: classNameList,
        widgetType: sourceKey,
        _parentId: isSlot(schema.parent as Schema)
          ? schema?.parent?.parent?.key
          : schema?.parent?.key,
      }
      if (dataBinds.length > 0) {
        compDataBinds[schema.key] = generateDataBinds(dataBinds, isComposite)
      }
      if (styleBind) {
        if (!styleBind.bindDataPath) {
          console.warn('无 bindDataPath', xProps)
        } else {
          styleBind.propertyPath = 'style'
          compDataBinds[schema.key] = {
            ...(compDataBinds[schema.key] || {}),
            ...generateDataBinds([styleBind], isComposite),
          }
        }
      }
      if (classNameListBind) {
        classNameListBind.propertyPath = 'classList'
        compDataBinds[schema.key] = {
          ...(compDataBinds[schema.key] || {}),
          ...generateDataBinds([classNameListBind], isComposite),
        }
      }
    }

    // 针对 JSON 体积做优化
    if (properties && isEmptyObj(properties)) {
      delete schema.properties
    }
    delete schema.type

    if (xProps) {
      // 如果是复合组件的根节点，则补充 wrapperClass
      if (isComposite) {
        if (!schema?.parent?.parent) {
          if (!xProps['classNameList']) xProps['classNameList'] = []
          xProps['classNameList'].push(wrapperClass)
        }
      }

      xProps['commonStyle'] = toCssStyle(xProps['commonStyle'])

      if (isEmptyObj(xProps['commonStyle'])) {
        delete xProps['commonStyle']
      }
      if (isEmptyObj(xProps['style'])) {
        delete xProps['style']
      }
      if (xProps['dataBinds'] && xProps['dataBinds'].length === 0) {
        delete xProps['dataBinds']
      }
      if (
        xProps['listenerInstances'] &&
        xProps['listenerInstances'].length === 0
      ) {
        delete xProps['listenerInstances']
      }
      if (xProps['data']) {
        const xPropsData = xProps['data']
        if (xPropsData._waFor && xPropsData._waFor.length === 0) {
          delete xPropsData._waFor
        }
        if (xPropsData.title === '') {
          delete xPropsData.title
        }
        if (isEmptyObj(xPropsData)) {
          delete xProps['data']
        }
      }

      if (xProps.listenerInstances) {
        xProps.listenerInstances = generateListnerInstances(
          xProps.listenerInstances,
          isComposite
        )
      }

      // 组件双向绑定
      const inputProps = componentInputProps[xProps.sourceKey]
      if (inputProps) {
        if (!xProps.listenerInstances) xProps.listenerInstances = []
        Object.keys(inputProps).forEach((key) => {
          const { changeEvent, valueFromEvent } = inputProps[key]
          // 双向绑定需要优先第一个执行
          xProps.listenerInstances.unshift({
            trigger: changeEvent,
            instanceFunction: `${REPLACE_SIGN}function({ event, forItems }) {
              const wid = ${isComposite ? 'this.widgets' : '$page.widgets'}.${
              schema.key
            };
              const widgetData = (forItems.forIndexes && forItems.forIndexes.length > 0) ? get(wid, forItems.forIndexes) : wid;
              widgetData.${key} = ${valueFromEvent};
            }.bind(this)${REPLACE_SIGN}`,
          })
        })
      }

      if (xProps.dataBinds) {
        xProps.dataBinds = generateDataBinds(xProps.dataBinds, isComposite)
      }

      if (xProps.styleBind) {
        xProps.styleBind = generateDataBinds([xProps.styleBind], isComposite)
      }

      if (xProps.classNameListBind) {
        xProps.classNameListBind = generateDataBinds(
          [xProps.classNameListBind],
          isComposite
        )
      }
    }
  })

  return {
    widgets: JsonToStringWithVariableName(compWidgets),
    dataBinds: JsonToStringWithVariableName(compDataBinds)
      .replace(/\\r/g, '\n')
      .replace(/\\"/g, '"'),
    componentSchema: JsonToStringWithVariableName(componentSchemaJson)
      .replace(/\\r/g, '\n')
      .replace(/\\"/g, '"'),
  }
}

// convert data binds to functions for performance & simplicity
function generateDataBinds(dataBinds, isComposite: boolean) {
  const dataBindFuncs = {}
  dataBinds.forEach((bind: IDataBind) => {
    if (!bind.bindDataPath) {
      return console.warn('无 bindDataPath', bind.propertyPath)
    }
    // 默认空函数, 避免出错
    let funcCode = '() => {}'
    funcCode = `() => ${funcCode}`
    if (bind.type === PropBindType.forItem) {
      funcCode = `(forItems) => forItems.${bind.bindDataPath}`
    } else if (bind.type === PropBindType.expression) {
      if (isComposite) {
        funcCode = `(forItems) => (${bind.bindDataPath
          .replace(/\n/g, ' ')
          .replace(/\$comp/g, 'this.$WEAPPS_COMP')})`
      } else {
        funcCode = `(forItems) => (${bind.bindDataPath.replace(/\n/g, ' ')})`
      }
    } else if (bind.type === PropBindType.prop) {
      let bindDataPath = bind.bindDataPath
      const isNegated = bindDataPath.startsWith('!')
      if (isNegated) bindDataPath = bindDataPath.replace(/^!/, '')
      if (isComposite) {
        // 复合组件在预览时其实就是page，所以沿用page的变量即可
        funcCode = `() => ${
          isNegated ? '!' : ''
        }this.$WEAPPS_COMP.props.data.${bindDataPath}`
      } else {
        // 复合组件在预览时其实就是page，所以沿用page的变量即可
        funcCode = `() => ${
          isNegated ? '!' : ''
        }$page.props.data.${bindDataPath}`
      }
    } else {
      const PREFIX_MAP = {
        [PropBindType.state]: 'state',
        [PropBindType.computed]: 'computed',
        [PropBindType.dataVar]: 'dataVar',
        [PropBindType.stateData]: 'dataset.state',
        [PropBindType.paramData]: 'dataset.params',
      }

      switch (bind.type) {
        case PropBindType.state:
        case PropBindType.computed:
        case PropBindType.dataVar:
        case PropBindType.stateData:
        case PropBindType.paramData: {
          if (bind.bindDataPath.startsWith('global.')) {
            funcCode = bind.bindDataPath.replace(
              /^global./,
              `app.${PREFIX_MAP[bind.type]}.`
            )
          } else {
            if (isComposite) {
              funcCode = bind.bindDataPath
                .replace(
                  /^comp-\w+./,
                  `this.$WEAPPS_COMP.${PREFIX_MAP[bind.type]}.`
                )
                .replace(
                  /^\$comp_\w+./,
                  `this.$WEAPPS_COMP.${PREFIX_MAP[bind.type]}.`
                )
            } else {
              funcCode = bind.bindDataPath.replace(
                /^\w+./,
                `$page.${PREFIX_MAP[bind.type]}.`
              )
            }
          }
          funcCode = `() => ${funcCode}`

          break
        }
      }
    }
    dataBindFuncs[
      bind.propertyPath
    ] = `${REPLACE_SIGN}${funcCode}${REPLACE_SIGN}`
  })
  return dataBindFuncs
}

function generateListnerInstances(
  listenerInstances: IListenerInstance[],
  isComposite = false
) {
  return listenerInstances.map((listener: IListenerInstance) => {
    const generatedListener: any = {
      trigger: listener.trigger,
      isCapturePhase: listener.isCapturePhase,
      noPropagation: listener.noPropagation,
    }
    if (listener.type === ActionType.Material) {
      const { sourceKey } = listener
      const { variableName } = getMetaInfoBySourceKey(sourceKey)
      generatedListener.instanceFunction = `${REPLACE_SIGN}${variableName}${REPLACE_SIGN}`
    } else if (listener.type === ActionType.PropEvent) {
      if (isComposite) {
        generatedListener.instanceFunction = `${REPLACE_SIGN}function({data}) { this.props.emit('${listener.handler.name}', data.target) }.bind(this)${REPLACE_SIGN}`
      } else {
        generatedListener.instanceFunction = `${REPLACE_SIGN}function(...args) { $page.props.events.${listener.handler.name}.apply(null, args) }${REPLACE_SIGN}`
      }
    } else {
      // Lowcode action(handler)
      if (isComposite) {
        generatedListener.instanceFunction = `${REPLACE_SIGN}this.handler.${listener.handler.name}.bind(this)${REPLACE_SIGN}`
      } else {
        generatedListener.instanceFunction = `${REPLACE_SIGN}handler.${listener.handler.name}${REPLACE_SIGN}`
      }
    }
    if (!isEmptyObj(listener.data)) {
      generatedListener.data = listener.data
    }
    if (listener.dataBinds && listener.dataBinds.length > 0) {
      generatedListener.dataBinds = generateDataBinds(
        listener.dataBinds,
        isComposite
      )
    }

    return generatedListener
  })
}

export function getListenersString(
  listeners: IListenerInstance[] = [],
  isComposite = false
) {
  return JsonToStringWithVariableName(
    generateListnerInstances(listeners, isComposite)
  )
}

export function getPluginInstancesString(instances: IItemInstance[]) {
  if (!instances || !instances.length) {
    return '[]'
  }
  const copyInstances = simpleDeepClone<IItemInstance[]>(instances)
  copyInstances.map((itemInstance) => {
    const { sourceKey } = itemInstance
    const { variableName } = getMetaInfoBySourceKey(sourceKey)
    itemInstance.instanceFunction = `${REPLACE_SIGN}${variableName}${REPLACE_SIGN}`
  })
  return JsonToStringWithVariableName(copyInstances)
}

export function getPluginImportStringArr(
  plugins: any,
  pluginImportStringArr: string[] = []
) {
  plugins.map(async (plugin: any) => {
    const { name, materialName, materialVersion, variableName } = plugin

    const importString = `import ${variableName} from 'libraries/${`${materialName}@${materialVersion}`}/plugins/${name}'`
    if (pluginImportStringArr.includes(importString)) {
      return
    }

    pluginImportStringArr.push(importString)
  })
  return pluginImportStringArr
}

export function getComponentImportStringArr(
  components: IOriginKeyInfo[],
  componentImportStringArr: string[] = []
) {
  components.map(async (component: IOriginKeyInfo) => {
    const { name, materialName, materialVersion, variableName } = component
    // const fullName = `${materialName}_${name}`

    // 这里将头字母变成大写是为了能在jsx中以<XXX/>去引用组件
    const importString = `import ${_.upperFirst(
      variableName
    )} from 'libraries/${`${materialName}@${materialVersion}`}/components/${name}'`
    if (!componentImportStringArr.includes(importString)) {
      componentImportStringArr.push(importString)
    }
  })
  return componentImportStringArr
}

export function getActionImportStringArr(
  originActionList: IOriginKeyInfo[],
  actionImportStringArr: string[] = []
) {
  originActionList.map((action: IOriginKeyInfo) => {
    if (action.type === ActionType.Material) {
      pushActionToImportStringArr(action, actionImportStringArr)
    }
  })
  return actionImportStringArr
}

export function pushActionToImportStringArr(
  listenerInstance: IOriginKeyInfo,
  actionImportStringArr: string[]
) {
  const { name, materialName, materialVersion, variableName } = listenerInstance

  const importString = `import ${variableName} from 'libraries/${materialName}@${materialVersion}/actions/${name}'`
  if (actionImportStringArr.includes(importString)) {
    return
  }

  actionImportStringArr.push(importString)
}

export async function generateRouterFile(
  allAppDataList: IWebRuntimeAppData[],
  appBuildDir: string,
  basename = '',
  buildTypeList
) {
  const routerImports: string[] = []
  const routerRenders: string[] = []
  const mountApis: string[] = []
  await Promise.all(
    allAppDataList.map(async (data) => {
      const { pageInstanceList, rootPath = '' } = data
      const pageFilePath = rootPath ? `packages/${rootPath}/` : ''
      // 判断app环境才进行加载引入
      mountApis.push(`import '${pageFilePath}app/mountAppApis';`)
      loopDealWithFn(pageInstanceList, (pageInstance: any) => {
        const pageId = [rootPath, pageInstance.id].filter((i) => i).join('_')
        if (pageInstance.isHome && !rootPath) {
          routerRenders.push(`<Redirect from="/" exact to="/${pageId}"/>`)
        }
        routerImports.push(
          `import Page${pageId} from '${pageFilePath}pages/${pageInstance.id}/index';`
        )
        routerRenders.push(
          `<Route path="/${pageId}" component={Page${pageId}}/>`
        )
      })
    })
  )
  const routerTemplate = await fs.readFile(
    path.resolve(appTemplateDir, './src/router/index.tpl'),
    {
      encoding: 'utf8',
    }
  )
  const routerIndexStr = tpl(routerTemplate)({
    routerImports: routerImports.join('\n'),
    routerRenders: routerRenders.join('\n'),
    mountApis: mountApis.join('\n'),
    basename: basename,
  })
  const dest = path.resolve(appBuildDir, `src/router/index.jsx`)
  await fs.ensureFile(dest)
  await fs.writeFile(dest, routerIndexStr)
}

export async function writeLowCodeFiles(
  appData: IWebRuntimeAppData,
  appBuildDir: string
) {
  const lowcodeRootDir = path.join(appBuildDir, 'lowcode')
  console.log(chalk.blue.bold('Writing lowcode files:'))
  generateDefaultTheme(appData)
  const themeCode = appData.codeModules.find((mod) => mod.type === 'theme')
  await Promise.all(appData.codeModules.map((m) => writeCode2file(m, 'global')))
  await Promise.all(
    loopDealWithFn(appData.pageInstanceList, async (page) => {
      generateDefaultStyle(page)
      await page.codeModules
        .filter((m) => m.name !== '____index____')
        .forEach((m) => writeCode2file(m, page.id))
    })
  )

  async function writeCode2file(mod: IWeAppCode, pageId: string) {
    const file = path.join(lowcodeRootDir, getCodeModuleFilePath(pageId, mod))
    let weappsApiPrefix = ''
    if (mod.type !== 'theme') {
      weappsApiPrefix =
        mod.type !== 'style'
          ? `import { app, $page } from '${path
              .relative(path.dirname(file), appBuildDir + '/app/global-api')
              .replace(/\\/g, '/')}';`
          : `` // windows compatibility
    }
    console.log(chalk.green(file))
    let code = mod.code
    if (mod.type === 'style') {
      code = await processLess((themeCode?.code || defaultThemeCode) + code)
    }

    await fs.ensureFile(file)
    await fs.writeFile(file, weappsApiPrefix + os.EOL + code)
  }
}

export async function writeLowCodeFilesForCompositeComp(
  compositeGroups: IMaterialItem[],
  appBuildDir: string
) {
  const lowcodeRootDir = path.join(appBuildDir, 'src', 'lowcode', 'composite')
  console.log(chalk.blue.bold('Writing composite component lowcode files:'))
  await Promise.all(
    compositeGroups.map(async (gItem) => {
      return await Promise.all(
        gItem.components.map(async (component) => {
          let cItem = component as ICompositedComponent
          return await cItem.lowCodes.forEach((m) =>
            writeCode2file(
              m,
              path.join(
                appBuildDir,
                'src',
                'libraries',
                `${gItem.name}@${gItem.version}`,
                'components',
                cItem.name,
                'lowcode'
              ),
              cItem
            )
          )
        })
      )
    })
  )

  async function writeCode2file(
    mod: IWeAppCode,
    lowcodeDir: string,
    comp: ICompositedComponent
  ) {
    const pageId = comp.name + '_' + comp.id
    const file = path.join(lowcodeDir, getCodeModuleFilePath(pageId, mod))
    await fs.ensureFile(file)

    let codeContent = ''

    if (mod.type === 'style') {
      codeContent = `.${getCompositedComponentClass(comp)} { ${mod.code} }` // pageId 作为组件样式的 scope
      try {
        codeContent = await processLess(codeContent)
      } catch (e) {
        console.error(`样式转换失败 [${pageId}] :`, e, codeContent)
      }
    } else {
      codeContent = `import { app } from 'app/global-api'
      ${mod.code.replace(/\$comp/g, 'this.$WEAPPS_COMP')};`
    }

    await fs.writeFile(file, codeContent)
  }
}

export async function generateCodeFromTpl(
  appData: IWebRuntimeAppData,
  appBuildDir: string,
  dependencies: IMaterialItem[],
  appKey: string,
  rootPath,
  deployMode: DEPLOY_MODE,
  extraData
) {
  const pageIds: string[] = []
  const pageModules = {}
  loopDealWithFn(appData.pageInstanceList, (p) => {
    pageIds.push(p.id)
    pageModules[p.id] = p.codeModules
  })

  const yyptConfig = await getYyptConfigInfo(extraData)

  // # all templates to be generated
  const templatesData = {
    'store/index.js': {
      pageIds,
      appId: appKey,
      rootPath: rootPath,
    },
    'app/handlers.js': {
      pageModules,
    },
    'app/material-actions.js': {
      materials: dependencies || [],
      _,
    },
    'app/common.js': {
      mods: appData.codeModules
        .filter((m) => m.type === 'normal-module' && m.name !== '____index____')
        .map((m) => m.name),
    },
    'store/computed.js': {
      pageIds,
    },
    'datasources/index.js.tpl': {
      envId: appData.envId,
    },
    'datasources/utils.js.tpl': {
      appId: appKey,
      isPreview: deployMode === DEPLOY_MODE.PREVIEW,
    },
    'datasources/datasources-profiles.js.tpl': {
      datasourceProfiles: JsonToStringWithVariableName(
        getDatasourceProfiles((appData as any).datasources || [])
      ),
    },
    'datasources/datavar-profiles.js.tpl': {
      datavarProfiles: JsonToStringWithVariableName(
        getDataVarProfiles(appData)
      ),
    },
    'datasources/dataset-profiles.js.tpl': {
      datasetProfiles: JsonToStringWithVariableName(
        getDatasetProfiles(appData)
      ),
    },
  }

  if (!rootPath) {
    templatesData['index.jsx'] = yyptConfig
  }

  console.log(chalk.blue.bold('Generating code by templates:'))
  // Generating file by template and data
  for (const file in templatesData) {
    const tplStr = await fs.readFile(path.join(appTemplateDir, 'src', file), {
      encoding: 'utf8',
    })
    const generatedCode = tpl(tplStr, {
      interpolate: /<%=([\s\S]+?)%>/g,
    })(templatesData[file])
    const outFile = path.resolve(appBuildDir, file.replace(/.tpl$/, ''))
    const outTplPath = /.tpl$/.test(file)
      ? path.resolve(appBuildDir, file)
      : null
    await fs.ensureFile(outFile)
    console.log(outFile)
    await fs.writeFile(outFile, generatedCode)
    if (outTplPath) {
      fs.removeSync(outTplPath)
    }
  }
}

export async function generateLocalFcuntions(
  appData: IWeAppData,
  templateDir: string,
  appBuildDir: string
) {
  const FUNCTION_PATH = 'local-functions'

  let functionNames: string[] = []
  // let dependencies = []

  fs.ensureDirSync(path.join(appBuildDir, FUNCTION_PATH))

  let promises =
    appData.datasources?.reduce((arr, datasource) => {
      let { appId, name } = datasource
      // let localFunctionName = getDatasourceResourceName(appId, name)
      let localFunctionName = name
      functionNames.push(localFunctionName)
      arr.push(
        fs.writeFile(
          path.join(appBuildDir, FUNCTION_PATH, `${localFunctionName}.js`),
          tpl(
            fs
              .readFileSync(
                path.resolve(templateDir, FUNCTION_PATH, 'fn.js.tpl')
              )
              .toString()
          )({
            datasource,
          }),
          { flag: 'w' }
        )
      )

      // dependencies = dependencies.concat(datasource.methods.map(method => method.calleeBody?.config?.deps || {}))

      return arr
    }, []) || []

  promises.push(
    fs.writeFile(
      path.join(appBuildDir, FUNCTION_PATH, `index.js`),
      tpl(
        fs
          .readFileSync(
            path.resolve(templateDir, FUNCTION_PATH, 'index.js.tpl')
          )
          .toString()
      )(appData),
      { flag: 'w' }
    )
  )

  try {
    await Promise.all(promises)
  } catch (e) {
    console.error(e)
  }

  console.log(path.join(appBuildDir, `index.js`))

  return functionNames
}
