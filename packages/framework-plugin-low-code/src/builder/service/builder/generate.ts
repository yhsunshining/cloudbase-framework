import path from 'path'
import fs from 'fs-extra'
import _ from 'lodash'
import tpl from 'lodash.template'
import { Schema } from '@formily/react-schema-renderer'
import chalk from 'chalk'
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
} from '../../../weapps-core'
import postcss from 'postcss'
import less from 'less'
import pxToRem from 'postcss-pxtorem'
import {
  deepDealSchema,
  getMetaInfoBySourceKey,
  JsonToStringWithVariableName,
  simpleDeepClone,
} from '../../util'
import { REPLACE_SIGN } from '../../config'
import { appTemplateDir } from '../../config'
import { buildAsWebByBuildType } from '../../types/common'
import os from 'os'

const homeDir = os.homedir()
const commandConfigPath = path.join(homeDir, '.warc')

export interface IOriginKeyInfo {
  name: string
  materialName: string
  materialVersion: string
  key: string
  variableName: string
  type?: ActionType
}

const remConfig = {
  rootValue: 28,
  propList: ['*'],
  unitPrecision: 5,
  selectorBlackList: [],
  replace: true,
  mediaQuery: false,
  minPixelValue: 0,
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
      const styleCodeModule = appData.codeModules.find(
        item => item.type === 'app-style' || item.type === 'style'
      )
      if (styleCodeModule && styleCodeModule.code) {
        const content = await fs.readFile(appLessPath, {
          encoding: 'utf8',
        })
        await fs.writeFile(appLessPath, `${content}\n${styleCodeModule.code}`, {
          encoding: 'utf8',
        })
      }
    }
  }
  const appLessContent = await fs.readFile(appLessPath, {
    encoding: 'utf8',
  })
  const { css: lessCss } = await less.render(appLessContent)
  const { css: remCss } = await postcss([pxToRem(remConfig)]).process(lessCss)
  await fs.writeFile(appLessPath, remCss, {
    encoding: 'utf8',
  })
}

export async function generateThemeVarsFile(themeVars: object = {}, appBuildDir: string) {
  const themeVarsPath = path.resolve(appBuildDir, './webpack/themeVars.js')
  await fs.writeFile(themeVarsPath, `module.exports = ${JSON.stringify(themeVars, null, 2)}`, {
    encoding: 'utf8',
  })
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
    loopDealWithFn(pageInstanceList, pageInstance =>
      generateSinglePageJsxFile(pageInstance, appBuildDir, dependencies, extraData, buildTypeList)
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
  } = pageInstance

  const { originComponentList, originActionList } = getOriginComponentAndActionList(
    componentSchemaJson,
    fixedDependencies
  )
  const originPluginList = getOriginPluginList(pluginInstances, dependencies)
  pullActionToListByInstances(pageListenerInstances, originActionList, fixedDependencies)

  const componentImportStringArr = getComponentImportStringArr(originComponentList)
  const actionImportStringArr = getActionImportStringArr(originActionList)
  const pluginImportStringArr = getPluginImportStringArr(originPluginList)

  const templateData = {
    pageName: pageInstance.id,
    componentImports: componentImportStringArr.join(';\n'),
    pluginImports: pluginImportStringArr.join(';\n'),
    actionImports: actionImportStringArr.join(';\n'),
    pageListenerInstances: getListenersString(pageListenerInstances),
    componentSchema: getComponentSchemaString(componentSchemaJson),
    virtualFields: getVirtualFieldsString(originComponentList),
    pluginInstances: getPluginInstancesString(pluginInstances),
    // 复合组件预览需要
    isComposite: extraData.isComposite,
    compProps: extraData.compProps,
  }

  const dest = path.resolve(appBuildDir, `./pages/${pageInstance.id}/index.jsx`)
  const template = await fs.readFile(path.resolve(appTemplateDir, './src/pages/app.tpl'), {
    encoding: 'utf8',
  })
  const jsx = tpl(template)(templateData)
  await fs.ensureFile(dest)
  await fs.writeFile(dest, jsx)

  // 生成小程序页面入口
  await fs.copy(
    path.resolve(appTemplateDir, './miniprogram/main.mp.jsx'),
    path.resolve(appBuildDir, `./pages/${pageInstance.id}/main.mp.jsx`)
  )

  // 生成页面样式
  const pageStyleDest = path.resolve(appBuildDir, `./pages/${pageInstance.id}/index.less`)
  const pageStyleString = toCssText(
    toCssStyle(PageStyle),
    buildAsWebByBuildType(buildTypeList) ? 'body' : 'page'
  )
  await fs.ensureFile(pageStyleDest)
  await fs.writeFile(pageStyleDest, pageStyleString)
  // if (buildTypeList.includes('mp')) {
  //   const pageStyleDest = path.resolve(appBuildDir, `./pages/${pageInstance.id}/index.less`)
  //   const pageStyleString = toCssText(toCssStyle(PageStyle), 'page')
  //   await fs.ensureFile(pageStyleDest)
  //   await fs.writeFile(pageStyleDest, pageStyleString)
  // }
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
      pullComponentToListByInstance(sourceKey, originComponentList, fixedDependencies)
      pullActionToListByInstances(listenerInstances, originActionList, fixedDependencies)
    }

    fieldSchema.mapProperties(schema => {
      const schemaJson = (schema as unknown) as IComponentSchemaJson
      getOriginComponentAndActionList(
        schemaJson,
        fixedDependencies,
        originComponentList,
        originActionList
      )
    })
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
    const { materialName, name, variableName } = getMetaInfoBySourceKey(sourceKey)
    const pluginKey = `${materialName}_${name}`
    const isExist = originPluginList.find((item: any) => item.key === pluginKey)
    if (isExist) {
      return
    }

    originPluginList.push({
      name,
      materialName,
      materialVersion: dependencies.find(m => m.name === materialName).version,
      key: pluginKey,
      variableName,
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
    const { materialName, name, variableName } = getMetaInfoBySourceKey(sourceKey)
    const material = fixedDependencies.find(m => m.name === materialName)
    const actionKey = `${materialName}_${name}`
    const isExistAction = originActionList.find((item: IOriginKeyInfo) => item.key === actionKey)
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
  originComponentList,
  fixedDependencies: IMaterialItem[]
) {
  const { materialName, name, variableName } = getMetaInfoBySourceKey(sourceKey)
  const componentKey = `${materialName}_${name}`
  const isExistComponent = originComponentList.find(
    (item: IOriginKeyInfo) => item.key === componentKey
  )
  if (!isExistComponent) {
    const foundOne = fixedDependencies.find(m => m.name === materialName)
    if (!foundOne) return
    originComponentList.push({
      name,
      materialName,
      materialVersion: foundOne.version,
      key: componentKey,
      variableName,
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

export function getComponentSchemaString(
  componentSchema: IComponentSchemaJson,
  isComposite = false
) {
  const copyJson = simpleDeepClone<IComponentSchemaJson>(componentSchema)
  const componentSchemaJson = deepDealSchema(copyJson, schema => {
    const { 'x-props': xProps, properties } = schema

    // 针对 JSON 体积做优化
    if (properties && isEmptyObj(properties)) {
      delete schema.properties
    }
    delete schema.key
    delete schema.type

    if (xProps) {
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
      if (xProps['listenerInstances'] && xProps['listenerInstances'].length === 0) {
        delete xProps['listenerInstances']
      }
      if (xProps['data']) {
        const xPropsData = xProps['data']
        if (xPropsData._visible === true) {
          delete xPropsData._visible
        }
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
      delete xProps.sourceKey

      if (xProps.listenerInstances) {
        xProps.listenerInstances = generateListnerInstances(xProps.listenerInstances, isComposite)
      }

      if (xProps.dataBinds) {
        xProps.dataBinds = generateDataBinds(xProps.dataBinds, isComposite)
      }

      if (xProps.styleBind) {
        xProps.styleBind = generateDataBinds([xProps.styleBind], isComposite)
      }

      if (xProps.classNameListBind) {
        xProps.classNameListBind = generateDataBinds([xProps.classNameListBind], isComposite)
      }
    }
  })
  return JsonToStringWithVariableName(componentSchemaJson)
}

// convert data binds to functions for performance & simplicity
function generateDataBinds(dataBinds, isComposite = false) {
  const dataBindFuncs = {}
  dataBinds.forEach((bind: IDataBind) => {
    let funcCode = ''
    if (bind.type === PropBindType.state) {
      if (bind.bindDataPath.startsWith('global.')) {
        funcCode = bind.bindDataPath.replace(/^global./, 'app.state.')
      } else {
        if (isComposite) {
          funcCode = bind.bindDataPath.replace(/^\$\w+_\d+./, 'this.state.')
        } else {
          funcCode = bind.bindDataPath.replace(/^\w+./, '$page.state.')
        }
      }
      funcCode = `() => ${funcCode}`
    } else if (bind.type === PropBindType.computed) {
      if (bind.bindDataPath.startsWith('global.')) {
        funcCode = bind.bindDataPath.replace(/^global./, 'app.computed.')
      } else {
        if (isComposite) {
          funcCode = bind.bindDataPath.replace(/^\$\w+_\d+./, 'this.computed.')
        } else {
          funcCode = bind.bindDataPath.replace(/^\w+./, '$page.computed.')
        }
      }
      funcCode = `() => ${funcCode}`
    } else if (bind.type === PropBindType.forItem) {
      funcCode = `(forItems) => forItems.${bind.bindDataPath}`
    } else if (bind.type === PropBindType.expression) {
      if (isComposite) {
        funcCode = `(forItems) => (${bind.bindDataPath
          .replace(/\n/g, ' ')
          .replace(/\$comp/g, 'this')})`
      } else {
        funcCode = `(forItems) => (${bind.bindDataPath.replace(/\n/g, ' ')})`
      }
    } else if (bind.type === PropBindType.prop) {
      let bindDataPath = bind.bindDataPath
      const isNegated = bindDataPath.startsWith('!')
      if (isNegated) bindDataPath = bindDataPath.replace(/^!/, '')
      if (isComposite) {
        // 复合组件在预览时其实就是page，所以沿用page的变量即可
        funcCode = `() => ${isNegated ? '!' : ''}this.props.data.${bindDataPath}`
      } else {
        // 复合组件在预览时其实就是page，所以沿用page的变量即可
        funcCode = `() => ${isNegated ? '!' : ''}$page.props.data.${bindDataPath}`
      }
    }
    dataBindFuncs[bind.propertyPath] = `${REPLACE_SIGN}${funcCode}${REPLACE_SIGN}`
  })
  return dataBindFuncs
}

function generateListnerInstances(listenerInstances: IListenerInstance[], isComposite = false) {
  return listenerInstances.map((listener: IListenerInstance) => {
    const generatedListener: any = { trigger: listener.trigger }
    if (listener.type === ActionType.Material) {
      const { sourceKey } = listener
      const { variableName } = getMetaInfoBySourceKey(sourceKey)
      generatedListener.instanceFunction = `${REPLACE_SIGN}${variableName}${REPLACE_SIGN}`
    } else if (listener.type === ActionType.PropEvent) {
      if (isComposite) {
        generatedListener.instanceFunction = `${REPLACE_SIGN}function({data}) { this.props.emit('${listener.handler.name}', {detail: data.target, name: '${listener.handler.name}'}) }.bind(this)${REPLACE_SIGN}`
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
      generatedListener.dataBinds = generateDataBinds(listener.dataBinds)
    }
    return generatedListener
  })
}

export function getListenersString(listeners: IListenerInstance[] = [], isComposite = false) {
  return JsonToStringWithVariableName(generateListnerInstances(listeners, isComposite))
}

export function getPluginInstancesString(instances: IItemInstance[]) {
  if (!instances || !instances.length) {
    return '[]'
  }
  const copyInstances = simpleDeepClone<IItemInstance[]>(instances)
  copyInstances.map(itemInstance => {
    const { sourceKey } = itemInstance
    const { variableName } = getMetaInfoBySourceKey(sourceKey)
    itemInstance.instanceFunction = `${REPLACE_SIGN}${variableName}${REPLACE_SIGN}`
  })
  return JsonToStringWithVariableName(copyInstances)
}

export function getPluginImportStringArr(plugins: any, pluginImportStringArr: string[] = []) {
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
    allAppDataList.map(async data => {
      const { pageInstanceList, rootPath = '' } = data
      const pageFilePath = rootPath ? `packages/${rootPath}/` : ''
      // 判断app环境才进行加载引入
      mountApis.push(`import '${pageFilePath}app/mountAppApis';`)
      loopDealWithFn(pageInstanceList, (pageInstance: any) => {
        const pageId = [rootPath, pageInstance.id].filter(i => i).join('_')
        if (pageInstance.isHome && !rootPath) {
          routerRenders.push(`<Redirect from="/" exact to="/${pageId}"/>`)
        }
        routerImports.push(
          `import Page${pageId} from '${pageFilePath}pages/${pageInstance.id}/index';`
        )
        routerRenders.push(`<Route path="/${pageId}" component={Page${pageId}}/>`)
      })
    })
  )
  const routerTemplate = await fs.readFile(path.resolve(appTemplateDir, './src/router/index.tpl'), {
    encoding: 'utf8',
  })
  const routerIndexStr = tpl(routerTemplate)({
    routerImports: routerImports.join('\n'),
    routerRenders: routerRenders.join('\n'),
    mountApis: mountApis.join('\n'),
    basename: basename,
  })
  const dest = path.resolve(appBuildDir, `src/router/index.jsx`)
  await fs.ensureFile(dest)
  await fs.writeFile(dest, routerIndexStr)
  // browser history 不使用 history文件， 内部使用 useHistory hook
  // const historyTemplate = await fs.readFile(
  //   path.resolve(appTemplateDir, './src/utils/history.js'),
  //   {
  //     encoding: 'utf8',
  //   }
  // )
  // const routerHistoryStr = tpl(historyTemplate)({
  //   publicPath,
  // })
  // await fs.writeFile(path.resolve(appBuildDir, `src/utils/history.js`), routerHistoryStr)
}

export async function writeLowCodeFiles(appData: IWebRuntimeAppData, appBuildDir: string) {
  const lowcodeRootDir = path.join(appBuildDir, 'lowcode')
  console.log(chalk.blue.bold('Writing lowcode files:'))
  await Promise.all(appData.codeModules.map(m => writeCode2file(m, 'global')))
  await Promise.all(
    loopDealWithFn(appData.pageInstanceList, async page => {
      await page.codeModules.forEach(m => writeCode2file(m, page.id))
    })
  )

  async function writeCode2file(mod: IWeAppCode, pageId: string) {
    const file = path.join(lowcodeRootDir, getCodeModuleFilePath(pageId, mod))
    const weappsApiPrefix = `import { app, $page } from '${path
      .relative(path.dirname(file), appBuildDir + '/app/global-api')
      .replace(/\\/g, '/')}'` // windows compatibility
    console.log(file)
    await fs.ensureFile(file)
    await fs.writeFile(file, weappsApiPrefix + '\n' + mod.code)
  }
}

export async function writeLowCodeFilesForCompositeComp(
  compositeGroups: any[],
  appBuildDir: string
) {
  const lowcodeRootDir = path.join(appBuildDir, 'src', 'lowcode', 'composite')
  console.log(chalk.blue.bold('Writing composite component lowcode files:'))
  await Promise.all(
    compositeGroups.map(async gItem => {
      return await Promise.all(
        gItem.components.map(async cItem => {
          return await cItem.lowCodes.forEach(m => writeCode2file(m, cItem.name + '_' + cItem.id))
        })
      )
    })
  )

  async function writeCode2file(mod: IWeAppCode, pageId: string) {
    const file = path.join(lowcodeRootDir, getCodeModuleFilePath(pageId, mod))
    console.log(file)
    await fs.ensureFile(file)

    let codeContent = ''

    if (mod.type === 'style') {
      codeContent = `.${pageId} { ${mod.code} }` // pageId 作为组件样式的 scope
      try {
        const { css: lessCss } = await less.render(codeContent)
        const { css: remCss } = await postcss([pxToRem(remConfig)]).process(lessCss)
        codeContent = remCss
      } catch (e) {
        console.error(`样式转换失败 [${pageId}] :`, e, codeContent)
      }
    } else {
      codeContent = `import { app } from 'app/global-api'
      ${mod.code.replace(/\$comp/g, 'this')}`
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
  extraData
) {
  let configJson
  const pageIds: string[] = []
  const pageModules = {}
  try {
    configJson = await fs.readJSON(commandConfigPath)
  } catch (e) {}
  configJson = configJson || {
    yyptAppKey: '',
    reportUrl: '',
    stopReport: false,
  }
  loopDealWithFn(appData.pageInstanceList, p => {
    pageIds.push(p.id)
    pageModules[p.id] = p.codeModules
  })

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

  const yyptConfig = {
    yyptAppKey,
    reportUrl,
    stopReport,
  }

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
        .filter(m => m.type === 'normal-module' && m.name !== '____index____')
        .map(m => m.name),
    },
    'store/computed.js': {
      pageIds,
    },
    'miniprogram-app.js': {
      ...yyptConfig,
      ...appData,
    },
    'index.jsx': yyptConfig,
  }

  console.log(chalk.blue.bold('Generating code by templates:'))
  // Generating file by template and data
  for (const file in templatesData) {
    const tplStr = await fs.readFile(path.join(appTemplateDir, 'src', file), {
      encoding: 'utf8',
    })
    const generatedCode = tpl(tplStr)(templatesData[file])
    const outFile = path.resolve(appBuildDir, file)
    await fs.ensureFile(outFile)
    console.log(outFile)
    await fs.writeFile(outFile, generatedCode)
  }
}
