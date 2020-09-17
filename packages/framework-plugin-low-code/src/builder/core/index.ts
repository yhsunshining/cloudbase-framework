import {
  extractAndRemoveKbConfig,
  installDependencies,
  IInstallOpts,
} from '../service/builder/webpack'
import { getCompileDirs } from '../service/builder'
import { IMaterialItem, deserialize, IWeAppData, IPlugin } from '../../weapps-core'
import { BuildType, GenerateMpType, WebpackBuildCallBack, WebpackModeType } from '../types/common'
export { buildAsWebByBuildType } from '../types/common'
import { getPluginType } from '../service/builder/plugin'
import { runGenerateCore } from './generate'
import { runHandleMaterial } from './material'
import { runCopy } from './copy'
import { createDoneCallBack, runPrepare } from './prepare'
import { runHandleKbonePlugin, runHandleMpPlugin } from './plugin'
import { runWebpackCore } from './webpack'

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
    publicPath = '/',
    buildTypeList = ['web'],
    mode = 'production',
    watch = false,
    generateMpType = 'app',
    generateMpPath = '',
    isCleanDistDir = false,
    plugins = [],
    extraData = {
      isComposite: false,
      compProps: {},
    },
  }: BuildAppProps,
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

  // 处理应用数据
  const mainAppData = deserialize(mainAppSerializeData)
  const subAppDataList = subAppSerializeDataList.map(sub => deserialize(sub))

  // 初始化目录
  const { appBuildDir, materialsDir } = getCompileDirs(appKey)

  // 前置操作
  const projectConfig = await runPrepare(buildTypeList, appBuildDir, isCleanDistDir)

  // 处理 mp_config
  const mpConfig = await extractAndRemoveKbConfig(mainAppData, subAppDataList, appBuildDir)
  // await Promise.all(
  //   subAppDataList.map(async sub => await extractAndRemoveKbConfig(sub, appBuildDir))
  // )

  // 复制 写入mainAppData.json
  await runCopy(appBuildDir, mainAppData)
  // 素材库
  const runHandleMaterialTag = '======= buildWebApp-runHandleMaterial'
  console.time(runHandleMaterialTag)
  dependencies = await runHandleMaterial(appBuildDir, dependencies, materialsDir)
  console.timeEnd(runHandleMaterialTag)
  const {
    appConfig: { window = {} },
  } = mainAppData

  // 安装依赖
  await runGenerateCore(
    appBuildDir,
    mainAppData,
    subAppDataList,
    dependencies,
    appKey,
    window.basename || '',
    buildTypeList,
    extraData
  )

  // 获取插件类型
  plugins = await getPluginType(appBuildDir, plugins)

  // 编译前置Kbone小程序的安装
  const kbonePlugins = plugins.filter(item => item.type === 'kbone')
  if (kbonePlugins && kbonePlugins.length > 0) {
    // config 会在内部改变，非 immuable 的
    await runHandleKbonePlugin(appBuildDir, kbonePlugins, mpConfig)
  }

  const doneCallback = createDoneCallBack({ appBuildDir, projectConfig }, cb)
  await runWebpackCore({
    appBuildDir,
    mainAppData,
    subAppDataList,
    materialsDir,
    dependencies,
    nodeModulesPath,
    publicPath: window.publicPath || '',
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

  // 编译后置原生小程序类的安装
  const mpPlugins = plugins.filter(item => item.type === 'mp')
  await runHandleMpPlugin(appBuildDir, mpPlugins, nodeModulesPath)

  return appBuildDir
}

export function installDep(dir, opts: IInstallOpts = {}) {
  return installDependencies(dir, opts)
}

export default buildWebApp
