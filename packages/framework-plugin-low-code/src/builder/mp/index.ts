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
} from '../../weapps-core'
import { appTemplateDir } from '../config'
import { getWxmlDataPrefix } from '../config/mp'
import generateFiles from '../util/generateFiles'
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
  const buildContext: IBuildContext = {
    projDir,
    appId,
    isProduction,
    materialLibs: materials,
    isMixMode,
  }
  await cleanProj(
    projDir,
    weapps.map((app) => app.rootPath).filter((dir) => !!dir) as string[]
  )

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
  const operationLabel = em('Wexin MiniProgram Generated')
  console.time(operationLabel)
  console.log('Generating ' + em('Wexin MiniProgram') + ' to ' + projDir)

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
    'weapps-common/process.js': {},
    'weapps-common/data-patch.js': {},
  }
  console.log('Generating ' + em('project') + ' files')
  await generateFiles(appFileData, templateDir, projDir, buildContext)

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
  weapps.forEach((app, index) =>
    generatePkg(
      app,
      projDir + '/' + (app.rootPath || ''),
      buildContext,
      pageConfigs[index]
    )
  )

  // 混合模式则清理未使用的组件库
  if (isMixMode) {
    const compositedLibs = materials.filter((item) => item.isComposite)
    await handleMixMaterials(projDir, weapps, appUsedComps, compositedLibs)
  }

  await installDependencies(projDir)

  await handleMpPlugins()

  console.timeEnd(operationLabel)
  return projDir

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
      const pageFileData = {
        'index.js': {
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
        'index.json': {
          usingComponents,
          extra: getAppendableJson(pageConfigs[page.id]),
        },
        'index.wxml': {
          // raw: JSON.stringify(page.componentInstances),
          content: wxml,
        },
        'index.wxss': {
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
  const allCodeModules = {}
  loopDealWithFn(appData.pageInstanceList, (p) => {
    allCodeModules[p.id] = p.lowCodes
  })
  const fileData = {
    'app/app-global.js': {},
    'app/weapps-api.js': {
      subLevelPath: appData.rootPath ? '../' : '',
      subPackageName: appData.rootPath || '',
    },
    'app/handlers.js': {
      pageModules: allCodeModules,
    },
    'app/common.js': {
      mods: appData.lowCodes
        .filter((m) => m.type === 'normal-module' && m.name !== '____index____')
        .map((m) => m.name),
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
  const compositedLibs = materials.filter(
    (lib) => lib.isComposite && allAppUsedComps[lib.name]
  )
  allAppUsedComps = extractUsedCompsRecursively(
    allAppUsedComps,
    [],
    compositedLibs
  )
  if (buildContext.isMixMode) {
    appUsedComps.forEach((item) => {
      const appCompositedLibs = materials.filter(
        (lib) => lib.isComposite && item.usedComps[lib.name]
      )
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

async function cleanProj(projDir: string, subAppDirs: string[]) {
  const dirs2del = ['pages', 'lowcode', 'materials', ...subAppDirs]
  console.log('Clean files:')
  for (const dir of dirs2del) {
    console.log(path.join(projDir, dir))
    await fs.remove(path.join(projDir, dir))
  }
}
