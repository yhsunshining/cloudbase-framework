import { WebpackBuildCallBack, buildAsWebByBuildType, BuildType } from '../types/common'
import { IPlugin, IWebRuntimeAppData } from '../../weapps-core'
import {
  generateMpJsonConfigFile,
  generateWebpackWebBuildParamsFile,
  startCompile,
  generateWebpackWebDevServerFile,
} from '../service/builder/webpack'
import { fixProcessCwd } from '../service/builder'
import { BuildAppProps } from './index'

interface IWebpackCoreProps extends BuildAppProps {
  appBuildDir: string
  materialsDir: string
  cb: WebpackBuildCallBack
  mpConfig: any
  mainAppData: IWebRuntimeAppData
  subAppDataList: IWebRuntimeAppData[]
}

export async function runWebpackCore({
  mainAppData,
  subAppDataList,
  appBuildDir,
  materialsDir,
  cb,
  mpConfig,
  dependencies,
  nodeModulesPath,
  publicPath,
  mode,
  watch,
  appKey,
  buildTypeList,
  generateMpType,
  generateMpPath,
  plugins,
}: IWebpackCoreProps) {
  console.time('runWebpackCore')
  console.time('webpackGenerate')
  const allAppDataList = subAppDataList.concat(mainAppData)
  const webWebpackConfigPath = await generateWebpackWebBuildParamsFile({
    allAppDataList,
    appBuildDir,
    materialsDir,
    dependencies,
    nodeModulesPath,
    publicPath,
    // @ts-ignore
    mode,
    // @ts-ignore
    watch,
    buildTypeList,
  })
  console.timeEnd('webpackGenerate')

  // compile
  const taskList = [] as Promise<any>[]
  console.time('generateMpJsonConfigFile')
  await generateMpJsonConfigFile(allAppDataList, mpConfig, appBuildDir, plugins as IPlugin[], {
    appKey,
    // @ts-ignore
    generateMpType,
  })
  console.timeEnd('generateMpJsonConfigFile')
  if (buildAsWebByBuildType(buildTypeList)) {
    await generateWebpackWebDevServerFile({
      appBuildDir,
      buildTypeList,
    })
    startCompile(
      {
        appBuildDir,
        configPath: webWebpackConfigPath,
        appKey,
      },
      cb as any
    )
  }
  console.time('webpackCompile')
  await Promise.all(taskList)
  console.timeEnd('webpackCompile')
  console.timeEnd('runWebpackCore')
}
