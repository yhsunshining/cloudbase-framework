import { WebpackBuildCallBack, buildAsWebByBuildType } from '../types/common'
import { IWebRuntimeAppData } from '../../weapps-core'
import {
  generateMpJsonConfigFile,
  generateWebpackMpBuildParamsFile,
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
  const webWebpackConfigPath = await generateWebpackWebBuildParamsFile({
    appBuildDir,
    materialsDir,
    dependencies,
    nodeModulesPath,
    publicPath,
    mode,
    watch,
    buildTypeList,
  })
  const allAppDataList = subAppDataList.concat(mainAppData)
  const mpWebpackConfigPath = await generateWebpackMpBuildParamsFile(
    {
      allAppDataList,
      appBuildDir,
      materialsDir,
      dependencies,
      nodeModulesPath,
      mode,
      watch,
      plugins,
    },
    {
      appKey,
      generateMpType,
    }
  )
  console.timeEnd('webpackGenerate')

  // compile
  const taskList = [] as Promise<any>[]
  console.time('generateMpJsonConfigFile')
  await generateMpJsonConfigFile(allAppDataList, mpConfig, appBuildDir, plugins, {
    appKey,
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
      cb
    )
  }
  if (buildTypeList.includes('mp')) {
    taskList.push(
      (async () => {
        fixProcessCwd(appBuildDir)
        startCompile(
          {
            appBuildDir,
            configPath: mpWebpackConfigPath,
            appKey,
            generateMpType,
            generateMpPath,
            plugins,
          },
          cb
        )
      })()
    )
  }
  console.time('webpackCompile')
  await Promise.all(taskList)
  console.timeEnd('webpackCompile')
  console.timeEnd('runWebpackCore')
}
