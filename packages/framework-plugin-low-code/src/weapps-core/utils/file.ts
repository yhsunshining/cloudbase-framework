import { IWeAppFile, IWeAppData, CodeType } from '../types'
import path from 'path'
import _ from 'lodash'

/**
 * WeApps 的文件系统
 * 配置文件
 * LowCode
 * JsonSchema
 */
/**
 * 将原本的 JSON SCHEMA 拆解为文件列表
 */
export function originJsonToFileList(appData: IWeAppData) {
  const configFiles = handleConfigJson(appData)
  const pageFiles = handlePageJson(appData)
  const lowCodeFiles = handleLowCodeFile(appData)
  return [...configFiles, ...pageFiles, ...lowCodeFiles]
}
/**
 * TODO: 将文件列表组合成 JSON SCHEMA
 */
// export function fileListToOriginJson(fileList: IWeAppFile[]) {}
// 处理配置类型文件
function handleConfigJson(appData: IWeAppData) {
  // 处理全局配置
  const homePageItem = appData.pageInstanceList.find((page) => !!page.isHome)
  const globalConfig = {
    appConfig: appData.appConfig,
    selectedPageId: appData.selectedPageId,
    npmDependencies: appData.npmDependencies,
    homePage: homePageItem && homePageItem.id,
    themeVars: appData.themeVars,
    presetColors: appData.presetColors,
  }
  const globalFile = {
    path: 'global/app-config',
    name: 'app-config',
    type: 'json',
    code: JSON.stringify(globalConfig, null, 2),
    pageId: 'global',
  }
  // 处理页面配置
  const pagesConfig = appData.pageInstanceList.map((page) => {
    const pageConfig = {
      data: page.data,
      commonStyle: page.commonStyle,
    }
    return {
      path: `${page.id}/page-config`,
      name: 'page-config',
      type: 'json',
      code: JSON.stringify(pageConfig, null, 2),
      pageId: page.id,
    }
  })
  return [globalFile].concat(pagesConfig)
}
// 处理页面类型
function handlePageJson(appData: IWeAppData) {
  return appData.pageInstanceList.map((page) => {
    const pageJsonFile = {
      name: 'page',
      pageId: page.id,
      path: `${page.id}/page`,
      type: 'json',
      code: JSON.stringify(page.componentInstances || {}, null, 2),
    }
    return pageJsonFile
  })
}
// 处理低代码类型
function handleLowCodeFile(appData: IWeAppData) {
  const globalLowCodes = appData.lowCodes
  const pagesLowCodes = appData.pageInstanceList.reduce((pageLowcode, page) => {
    return pageLowcode.concat(page.lowCodes as any)
  }, [])
  return [...globalLowCodes, ...pagesLowCodes]
}
function initOriginJson(fileList: IWeAppFile[]) {
  const data: any = {
    pageInstanceList: [],
    appConfig: {},
    lowCodes: getCommonLowCodes('global'),
    npmDependencies: {},
    plugins: [],
  }
  // 初始化页面信息
  fileList
    .filter(({ pageId }) => pageId !== 'global')
    .forEach(({ pageId }) => {
      // 将页面类型的结构初始化好
      const pageInstance = data.pageInstanceList.find(
        (page) => page.id === pageId
      )
      if (!pageInstance) {
        data.pageInstanceList.push({
          id: pageId,
          data: {},
          componentInstances: {},
          lowCodes: getCommonLowCodes(pageId),
          isHome: false,
          listeners: [],
          commonStyle: {},
          pluginInstances: [],
          styleBindPath: '',
        })
      }
    })
  return data
}
function getCommonLowCodes(pageId: string) {
  const isGlobal = pageId === 'global'
  const commonLowCodes: any[] = []
  if (isGlobal) {
    commonLowCodes.concat([
      {
        code: 'export default {}',
        name: '____index____',
        pageId: 'global',
        type: 'normal-module',
        path: 'global/common/____index____',
        system: false,
      },
    ])
  } else {
    commonLowCodes.concat([
      {
        code: 'export default {}',
        name: '____index____',
        pageId,
        path: `${pageId}/handler/____index____`,
        type: 'handler-fn',
        system: false,
      },
    ])
  }
  return commonLowCodes
}
// 只处理非 js 文件的
// 'rematch' | 'rematch-action' | 'computed' | 'general-func' | 'general' | 'lifecycle' | 'config' | 'state' | 'handler-fn' | 'normal-module' | 'app-style' | 'style' | 'theme'
export function getExtByType(type: CodeType) {
  switch (type as any) {
    case 'app-style':
    case 'style':
    case 'theme':
      return '.less'
    case 'config':
    case 'json':
    case 'app-config':
    case 'page-config':
      return '.json'
    default:
      return '.js'
  }
}

// HACK: 当前编辑器端文件目录不规范，需要兼容一下目录
// 修复接收低代码
export function HACK_FIX_LOWCODE_IN(code = '') {
  return code.replace('../../common/', '../../../common/')
}
export function HACK_FIX_LOWCODE_OUT(code = '') {
  return code.replace('../../../common/', '../../common/')
}
