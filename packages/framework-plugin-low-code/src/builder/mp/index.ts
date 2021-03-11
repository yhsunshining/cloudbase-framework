import chalk from 'chalk'
import path from 'path'
import { inspect } from 'util'
import * as fs from 'fs-extra'
import {
  IMaterialItem,
  IWeAppData,
  loopDealWithFn,
  IPlugin,
  toCssText,
  toCssStyle,
  IWeAppCode,
} from '../../weapps-core'
import { appTemplateDir, rootDir, materialsDirName } from '../config'
import { getWxmlDataPrefix } from '../config/mp'
import generateFiles, { removeFile, cleanDir } from '../util/generateFiles'
import { extractUsedCompsRecursively, installMaterials } from './materials'
import {
  installDependencies,
  getMainAppDataByList,
} from '../service/builder/webpack'
import { IBuildContext } from './BuildContext'
import { createWidgetProps, createEventHanlders, createDataBinds } from './util'
import { generateWxml, getUsedComponents } from './wxml'
import { writeCode2file } from './lowcode'
import { generateMpConfig } from './mp_config'
import { getPluginType } from '../service/builder/plugin'
import { runHandleMpPlugin } from '../core/plugin'
import { getYyptConfigInfo, JsonToStringWithVariableName } from '../util'
import { generateDefaultTheme, generateDefaultStyle } from '../util/style'
import {
  getDatasourceProfiles,
  getDataVarProfiles,
  getDatasetProfiles,
} from '../../utils/dataSource'
import { generateLocalFunctions } from '../service/builder/generate'
import { DEPLOY_MODE } from '../../index'
import { IAppUsedComp, IUsedComps } from '../types/common'
import { handleMixMaterials } from './mixMode'
import { get } from 'lodash'
import * as junk from '../util/junk'

const templateDir = appTemplateDir + '/mp/'
const em = chalk.blue.bold
const error = chalk.redBright

export async function generateWxMp(
  weapps: IWeAppData[],
  projDir: string,
  appId: string, // 应用appId
  materials: IMaterialItem[],
  plugins: IPlugin[],
  isProduction: boolean,
  deployMode: DEPLOY_MODE,
  extraData: any,
  isMixMode: boolean
) {
  const operationLabel = em('Wexin MiniProgram Generated')
  console.time(operationLabel)
  console.log('Generating ' + em('Wexin MiniProgram') + ' to ' + projDir)

  const buildContext: IBuildContext = {
    projDir,
    appId,
    isProduction,
    materialLibs: materials,
    isMixMode,
  }

  let mainAppData = weapps[0]
  const yyptConfig = await getYyptConfigInfo(extraData)
  const { appUsedComps, allAppUsedComps } = handleUsedComponents({
    buildContext,
    weapps,
    materials,
  })

  // 安装依赖库
  await installMaterials(projDir, allAppUsedComps, weapps, buildContext)

  const wxmlDataPrefix = getWxmlDataPrefix(!isProduction)

  const { projConfig, appConfig, pageConfigs } = generateMpConfig(
    weapps,
    buildContext
  )

  // #1 generate project files
  const appFileData = {
    'app.js': { yyptConfig: yyptConfig },
    'app.json': { content: appConfig },
    'app.wxss': {
      importStyles: materials.reduce((styles, lib) => {
        styles = styles.concat(
          (lib.styles || []).map((stylePath) =>
            stylePath && !stylePath.startsWith('/')
              ? `/materials/${lib.name}/${stylePath}`
              : stylePath
          ) || []
        )
        return styles
      }, [] as string[]),
    },
    'project.config.json': { content: projConfig },
    'package.json': {
      appId,
      extraDeps: resolveNpmDeps(),
    },
    'common/style.js': {},
    'common/util.js': {},
    'common/widget.js': {},
    'common/url.js': {},
    'common/wx_yypt_report_v2.js': {},
    'common/weapp-sdk.js': {},
    'common/weapp-page.js': {
      dataPropNames: wxmlDataPrefix,
      debug: !buildContext.isProduction,
    },
    'common/weapp-component.js': {},
    'common/merge-renderer.js': {
      dataPropNames: wxmlDataPrefix,
      debug: !buildContext.isProduction,
    },
    'common/process.js': {},
    'common/data-patch.js': {},
  }
  console.log('Generating ' + em('project') + ' files')
  const generatedAppFiles = await generateFiles(
    appFileData,
    templateDir,
    projDir,
    buildContext
  )

  const datasourceFileData = {
    'datasources/database.js': {},
    'datasources/datasources.js': {},
    'datasources/datavar.js': {},
    'datasources/dataset.js': {},
    'datasources/operators.js': {},
    'datasources/tcb.js': {},
    'datasources/utils.js.tpl': {
      appId,
      isPreview: deployMode === DEPLOY_MODE.PREVIEW,
    },
    'datasources/index.js.tpl': {
      envId: mainAppData.envId,
    },
    'datasources/datasources-profiles.js.tpl': {
      datasourceProfiles: JsonToStringWithVariableName(
        getDatasourceProfiles((mainAppData as any).datasources || [])
      ),
    },
    'datasources/datavar-profiles.js.tpl': {
      datavarProfiles: JsonToStringWithVariableName(
        getDataVarProfiles(mainAppData as any)
      ),
    },
    'datasources/dataset-profiles.js.tpl': {
      datasetProfiles: JsonToStringWithVariableName(
        getDatasetProfiles(mainAppData as any)
      ),
    },
  }
  console.log('Generating ' + em('datasources') + ' files')
  await generateFiles(datasourceFileData, templateDir, projDir, buildContext)

  console.log('Generating ' + em('local-function') + ' files')
  await generateLocalFunctions(mainAppData, templateDir, projDir)

  // 生成子包
  await Promise.all(
    weapps.map((app, index) =>
      generatePkg(
        app,
        projDir + path.sep + (app.rootPath || ''),
        buildContext,
        pageConfigs[index]
      )
    )
  )

  // 混合模式则清理未使用的组件库
  if (isMixMode) {
    const compositedLibs = materials.filter((item) => item.isComposite)
    await handleMixMaterials(projDir, weapps, appUsedComps, compositedLibs)
  }

  const packageInfoChanged = generatedAppFiles.indexOf('package.json') > -1
  if (packageInfoChanged) {
    await installDependencies(projDir)
  }

  await handleMpPlugins()

  console.timeEnd(operationLabel)
  cleanProj(weapps, projDir)
  cleanMaterils(
    projDir + path.sep + materialsDirName,
    !isMixMode ? allAppUsedComps : appUsedComps[0].usedComps
  )
  return { packageInfoChanged }

  function resolveNpmDeps() {
    const deps = weapps.map((app) => app.npmDependencies)
    materials.map((lib) => deps.push((lib as any).dependencies))

    // 合并组件库的公共npm
    materials.map((compLb) => {
      if (compLb.isComposite && compLb.compLibCommonResource) {
        deps.push(compLb.compLibCommonResource.npm || {})
      }
    })
    return deps.reduce((combined, cur) => {
      return { ...combined, ...cur }
    }, {})
  }

  // SDK 插件
  async function handleMpPlugins() {
    // 编译后置原生小程序类的安装
    const mpPlugins = (await getPluginType(projDir, plugins)).filter(
      (item) => item.type === 'mp'
    )
    await runHandleMpPlugin(projDir, mpPlugins)
  }
}

async function generatePkg(
  weapp: IWeAppData,
  appRoot: string,
  ctx: IBuildContext,
  pageConfigs
) {
  const wxmlDataPrefix = getWxmlDataPrefix(!ctx.isProduction)
  console.log('Generating ' + em('app') + ' to ' + appRoot)
  // #2 generate page files
  console.log('Generating ' + em('page') + ' files')
  await Promise.all(
    weapp.pageInstanceList.map(async (page) => {
      // # Generating page
      const rootPath = weapp.rootPath || ''
      const usingComponents = {}
      const wxml = generateWxml(
        page.componentInstances,
        `Page ${weapp.rootPath}/${page.id}`,
        wxmlDataPrefix,
        { ...ctx, rootPath },
        usingComponents
      )

      const pageFileName = get(pageConfigs, `${page.id}.pageFileName`, 'index')
      const pageFileData = {
        [`index.js|${pageFileName}.js`]: {
          widgetProps: createWidgetProps(page.componentInstances, ctx),
          pageName: page.id,
          eventHanlders: createEventHanlders(
            page.componentInstances,
            '$page',
            ctx
          ),
          dataBinds: createDataBinds(page.componentInstances, ctx),
          debug: !ctx.isProduction,
          stringifyObj: inspect,
          subLevelPath: rootPath ? '../' : '',
        },
        [`index.json|${pageFileName}.json`]: {
          usingComponents,
          extra: getAppendableJson(pageConfigs[page.id]),
        },
        [`index.wxml|${pageFileName}.wxml`]: {
          // raw: JSON.stringify(page.componentInstances),
          content: wxml,
        },
        [`index.wxss|${pageFileName}.wxss`]: {
          subWxss: rootPath ? '@import "../../lowcode/style.wxss";' : '',
          content: toCssText(
            toCssStyle(page.commonStyle, {
              toRem: false,
              toRpx: true,
            }),
            'page'
          ),
          pageWxss: `@import "../../lowcode/${page.id}/style.wxss"`,
        },
        'api.js': {},
      }
      // Generating file by template and data
      await generateFiles(
        pageFileData,
        templateDir + '/page',
        path.join(appRoot, 'pages', page.id),
        ctx
      )
    })
  )

  // #3 writing lowcode files
  await writeLowCodeFiles(weapp, appRoot, ctx)
  await generateFramework(weapp, appRoot, ctx)
}

async function generateFramework(
  appData: IWeAppData,
  outDir: string,
  ctx: IBuildContext
) {
  const allCodeModules: { id: string; lowCodes: IWeAppCode[] }[] = []
  loopDealWithFn(appData.pageInstanceList, (p) => {
    allCodeModules.push({
      id: p.id,
      lowCodes: p.lowCodes || [],
    })
  })
  const fileData = {
    'app/app-global.js': {},
    'app/weapps-api.js': {
      subLevelPath: appData.rootPath ? '../' : '',
      subPackageName: appData.rootPath || '',
    },
    'app/handlers.js': {
      pageModules: allCodeModules.sort(),
    },
    'app/common.js': {
      mods: appData.lowCodes
        .filter((m) => m.type === 'normal-module' && m.name !== '____index____')
        .map((m) => m.name)
        .sort(),
    },
  }
  console.log('Generate app framework')
  await generateFiles(fileData, templateDir, outDir, ctx)
}

const THEME = 'theme'
const STYLE = 'style'
export async function writeLowCodeFiles(
  appData: IWeAppData,
  outDir: string,
  ctx: IBuildContext
) {
  console.log('Writing ' + em('lowcode') + ' files:')
  const lowcodeRootDir = path.join(outDir, 'lowcode')
  const themeStyle = generateDefaultTheme(appData)
  await Promise.all(
    appData.lowCodes
      .filter((mod) => mod.name !== '____index____')
      .map((m) =>
        writeCode2file(m, lowcodeRootDir, { appDir: outDir }, themeStyle.code)
      )
  )

  await Promise.all(
    loopDealWithFn(appData.pageInstanceList, async (page) => {
      generateDefaultStyle(page)
      await page?.lowCodes
        ?.filter((mod) => mod.name !== '____index____')
        .forEach((m) =>
          writeCode2file(
            m,
            lowcodeRootDir,
            { pageId: page.id, appDir: outDir },
            themeStyle.code,
            ctx
          )
        )
    })
  )
}

// {a: 1} -> , "a": 1
function getAppendableJson(obj) {
  if (obj && Object.keys(obj).length > 0) {
    const str = JSON.stringify(obj)
    return ',\n' + str.substr(1, str.length - 2)
  }
  return ''
}

// 处理使用到的组件
function handleUsedComponents({
  buildContext,
  weapps,
  materials,
}: {
  buildContext: IBuildContext
  weapps: IWeAppData[]
  materials: IMaterialItem[]
}) {
  const appUsedComps: IAppUsedComp[] = weapps.map((app) => {
    const usedComps: IUsedComps = {}
    app.pageInstanceList.forEach((p) =>
      getUsedComponents(p.componentInstances, usedComps)
    )
    return {
      rootPath: app.rootPath || '',
      usedComps,
    }
  })
  // merge all app/subapp used
  let allAppUsedComps: IUsedComps = appUsedComps.reduce((comps, item) => {
    Object.keys(item.usedComps).forEach((libName) => {
      comps[libName] = new Set([
        ...Array.from(item.usedComps[libName]),
        ...Array.from(comps[libName] || []),
      ])
    })
    return comps
  }, {})
  const compositedLibs = materials.filter((lib) => lib.isComposite)
  allAppUsedComps = extractUsedCompsRecursively(
    allAppUsedComps,
    [],
    compositedLibs
  )
  if (buildContext.isMixMode) {
    appUsedComps.forEach((item) => {
      const appCompositedLibs = materials.filter((lib) => lib.isComposite)
      item.usedComps = extractUsedCompsRecursively(
        item.usedComps,
        [],
        appCompositedLibs
      )
    })
  }

  return {
    appUsedComps,
    allAppUsedComps,
  }
}

async function cleanProj(weapps: IWeAppData[], projDir: string) {
  weapps.map((pkg) => cleanPkg(pkg, projDir))
}

async function cleanPkg(pkg: IWeAppData, projDir: string) {
  const pkgDir = [projDir, pkg.rootPath].filter((p) => !!p).join(path.sep)
  const pagesDir = path.join(pkgDir, 'pages')
  const lowcodesDir = path.join(pkgDir, 'lowcode')
  const existedPages = await fs.readdir(pagesDir)
  const pages = pkg.pageInstanceList.map((p) => p.id)

  existedPages.forEach((pageName) => {
    const pageDir = path.join(pagesDir, pageName)
    const lowcodeDir = path.join(lowcodesDir, pageName)
    if (pages.indexOf(pageName) < 0) {
      // #1 clean page & lowcode of deleted page
      removeFile(pageDir)
      removeFile(lowcodeDir)
    } else {
      // #2 clean deleted handlers
      const handlersDir = path.join(lowcodeDir, 'handler')
      const handlers =
        pkg?.pageInstanceList
          ?.find((p) => p.id === pageName)
          ?.lowCodes?.filter((m) => m.type === 'handler-fn')
          ?.map((m) => m.name + '.js') || []
      cleanDir(handlersDir, handlers)
    }
  })
  // #3 clean deleted common modules
  const commonModules = pkg.lowCodes
    .filter((m) => m.type === 'normal-module')
    .map((m) => m.name + '.js')
  const commonDir = path.join(lowcodesDir, 'common')
  cleanDir(commonDir, commonModules)
}

/**
 * Delete unsed materials
 */
function cleanMaterils(materialsDir: string, usedComps: IUsedComps) {
  fs.readdirSync(materialsDir)
    .filter(junk.not)
    .map((libName) => {
      const libDir = path.join(materialsDir, libName)

      if (
        fs.existsSync(path.join(libDir, 'meta.json')) ||
        fs.existsSync(path.join(libDir, 'mergeMeta.json'))
      ) {
        // Skip none-composited materials
        return
      }
      if (!usedComps[libName]) {
        removeFile(libDir)
        return
      }
      cleanDir(libDir, [...Array.from(usedComps[libName]), 'libCommonRes'])
    })
}
