import {
  extractAndRemoveKbConfig,
  installDependencies,
  IInstallOpts,
} from '../service/builder/webpack'
import { getCompileDirs } from '../service/builder'
import {
  IMaterialItem,
  deserialize,
  IWeAppData,
  IPlugin,
} from '../../weapps-core'
import {
  BuildType,
  GenerateMpType,
  WebpackBuildCallBack,
  WebpackModeType,
} from '../types/common'
export { buildAsWebByBuildType } from '../types/common'
import { getPluginType } from '../service/builder/plugin'
import { runGenerateCore } from './generate'
import { runHandleMaterial } from './material'
import { runCopy } from './copy'
import { createDoneCallBack, runPrepare } from './prepare'
import { runHandleKbonePlugin, runHandleMpPlugin } from './plugin'
import { runWebpackCore } from './webpack'
import { generateWxMp } from '../mp'
import path from 'path'
import { DEPLOY_MODE } from '../../index'

export type BuildAppProps = {
  dependencies: IMaterialItem[]
  mainAppSerializeData?: IWeAppData
  subAppSerializeDataList?: IWeAppData[]
  appKey: string
  nodeModulesPath: string
  publicPath?: string
  buildTypeList: BuildType[]
  mode?: WebpackModeType
  watch?: boolean
  generateMpType?: GenerateMpType
  generateMpPath?: string
  isCleanDistDir?: boolean
  plugins?: IPlugin[]
  extraData?: {
    isComposite: boolean
    compProps: any
  }
}

export async function buildWebApp(
  {
    mainAppSerializeData,
    subAppSerializeDataList = [],
    dependencies,
    appKey = 'test',
    nodeModulesPath,
    buildTypeList = [BuildType.WEB],
    mode = WebpackModeType.PRODUCTION,
    deployMode = DEPLOY_MODE.PREVIEW,
    watch = false,
    generateMpType = GenerateMpType.APP,
    generateMpPath = '',
    isCleanDistDir = false,
    plugins = [],
    extraData = {
      isComposite: false,
      compProps: {},
    },
  }: BuildAppProps & { deployMode: DEPLOY_MODE },
  cb?: WebpackBuildCallBack
) {
  if (!mainAppSerializeData) {
    console.error('无效的应用配置')
    return
  }
  console.log('应用名', appKey)
  console.log('生成模式', generateMpType)
  if (generateMpType === 'subpackage') {
    console.log('主包项目路径', generateMpPath)
  }

  let { appBuildDir } = getCompileDirs(appKey)
  const { materialsDir } = getCompileDirs(appKey)

  const startTime = Date.now()
  if (buildTypeList.includes(BuildType.MP)) {
    appBuildDir = path.join(appBuildDir, 'mp')
    try {
      const outDir = await generateWxMp(
        [mainAppSerializeData, ...subAppSerializeDataList],
        appBuildDir,
        appKey,
        dependencies,
        plugins,
        mode === WebpackModeType.PRODUCTION,
        deployMode,
        extraData
      )
      cb && cb(null, { outDir, timeElapsed: Date.now() - startTime })
      return outDir
    } catch (e) {
      cb && cb(e)
      return
    }
  } else {
    appBuildDir = path.join(appBuildDir, 'h5')

    // 处理应用数据
    const mainAppData = deserialize(mainAppSerializeData)
    const subAppDataList = subAppSerializeDataList.map((sub) =>
      deserialize(sub)
    )

    // 前置操作
    const { publicPath, basename } = mainAppData.appConfig?.window || {}
    const projectConfig = await runPrepare(
      buildTypeList,
      appBuildDir,
      isCleanDistDir
    )

    // 处理 mp_config
    const mpConfig = await extractAndRemoveKbConfig(
      mainAppData,
      subAppDataList,
      appBuildDir
    )

    // 复制
    await runCopy(appBuildDir, mainAppData)
    // 素材库
    const runHandleMaterialTag = '======= buildWebApp-runHandleMaterial'
    console.time(runHandleMaterialTag)
    await runHandleMaterial(appBuildDir, dependencies, materialsDir)
    console.timeEnd(runHandleMaterialTag)
    // 安装依赖
    await runGenerateCore(
      appBuildDir,
      mainAppData,
      subAppDataList,
      dependencies,
      appKey,
      basename,
      buildTypeList,
      deployMode,
      extraData
    )

    const doneCallback = createDoneCallBack({ appBuildDir, projectConfig }, cb)
    await runWebpackCore({
      appBuildDir,
      mainAppData,
      subAppDataList,
      materialsDir,
      dependencies,
      nodeModulesPath,
      publicPath,
      mode,
      watch,
      appKey,
      cb: doneCallback,
      mpConfig,
      buildTypeList,
      generateMpType,
      generateMpPath,
      plugins,
    })

    return appBuildDir
  }
}

export function installDep(dir, opts: IInstallOpts = {}) {
  return installDependencies(dir, opts)
}

export default buildWebApp
