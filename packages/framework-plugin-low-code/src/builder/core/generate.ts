import { IMaterialItem, IWebRuntimeAppData } from '../../weapps-core'
import { BuildType } from '../types/common'
import {
  generateAllPageJsxFile,
  generateAppStyleLessFile,
  generateRouterFile,
  generateThemeVarsFile,
  generateCodeFromTpl,
  writeLowCodeFiles,
} from '../service/builder/generate'
import path from 'path'
import { installDependencies } from '../service/builder/webpack'
import fs from 'fs-extra'
import { notice, log } from '../util/console'
import { appTemplateDir } from '../config'

let lastDeps = null

function isInLastDeps(deps) {
  for (const i in deps) {
    if (!lastDeps[i] || lastDeps[i] !== deps[i]) {
      log(`package.json ${i}:${deps[i]} 和 上一次依赖${lastDeps[i]} 不一致, 重新安装依赖...`)
      return false
    }
  }
  return true
}

export async function runGenerateCore(
  appBuildDir: string,
  appData: IWebRuntimeAppData,
  subAppDataList: IWebRuntimeAppData[] = [],
  dependencies: IMaterialItem[] = [],
  appKey: string,
  basename: string, // browser Router 里指定的basename
  buildTypeList: BuildType[],
  extraData: {
    isComposite: boolean
    compProps: any
  } = {
    isComposite: false,
    compProps: {},
  }
) {
  const timeTag = '-------------------- runGenerateCore'
  console.time(timeTag)
  const allAppDataList = subAppDataList.concat(appData)

  // 安装插件依赖
  const deps = {}
  allAppDataList.map(app => {
    Object.entries(app.npmDependencies).forEach(([name, version]) => {
      deps[name] = version
    })
  })
  await Promise.all(
    allAppDataList.map(async data => {
      const { pageInstanceList, rootPath = '' } = data
      const appName = rootPath ? 'Sub app ' + rootPath : 'Main app'
      console.log('Generating files for ' + appName)
      const dstDir = path.join(appBuildDir, 'src', rootPath ? `packages/${rootPath}` : '')
      await copy(['app/global-api.js', 'app/mountMpApis.js', 'app/mountAppApis.js'], dstDir)
      await generateAllPageJsxFile(pageInstanceList, dstDir, dependencies, extraData, buildTypeList)
      await generateCodeFromTpl(data, dstDir, dependencies, appKey, rootPath, extraData)
      await writeLowCodeFiles(data, dstDir)
    })
  )
  await generateRouterFile(allAppDataList, appBuildDir, basename, buildTypeList)
  await generateAppStyleLessFile(allAppDataList, appBuildDir)
  await generateThemeVarsFile(appData.themeVars, appBuildDir)
  if (lastDeps && isInLastDeps(deps)) {
    notice('package.json dependencies 已经安装，如出现未安装成功或找不到依赖，请重启wa watch')
  } else {
    await generatePackageJSON(deps, appBuildDir, appKey)
    await installDependencies(appBuildDir)
    lastDeps = deps
  }

  console.timeEnd(timeTag)
}
export async function generatePackageJSON(dependencies: object = {}, appBuildDir: string, appKey) {
  const packageInfo = fs.readJSONSync(path.join(appTemplateDir, 'package.json'))
  packageInfo.dependencies = { ...packageInfo.dependencies, ...dependencies }
  packageInfo.name = 'weapps-' + appKey
  const dstFilePath = path.join(appBuildDir, 'package.json')
  await fs.writeFile(dstFilePath, JSON.stringify(packageInfo, null, '\t'))
}

async function copy(srcFiles: string[], dstDir: string) {
  for (const entry of srcFiles) {
    const dstFile = path.join(dstDir, entry)
    console.log(dstFile)
    await fs.copy(path.join(appTemplateDir, 'src', entry), dstFile)
  }
}
