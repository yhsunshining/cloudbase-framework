import path from 'path'
import os from 'os'
import symlinkDir from 'symlink-dir'
import { promiseWrapper } from '../../util'
import fs from 'fs-extra'
import {
  IPageInstance,
  IWebRuntimeAppData,
  loopDealWithFn,
  IWeAppCode,
} from '../../../weapps-core'

interface ICompileDirs {
  rootBuildDir: string
  appBuildDir: string
  materialsDir: string
}

export function getCompileDirs(appKey = 'test'): ICompileDirs {
  const materialsDir = path.join(os.homedir(), '.weapps-materials')
  const rootBuildDir = path.join(os.homedir(), '.weapps-build')
  const appBuildDir = path.join(rootBuildDir, appKey)

  return {
    rootBuildDir,
    appBuildDir,
    materialsDir,
  }
}

export async function createNodeModulesSoftLink(appBuildDir: string, nodeModulesPath: string) {
  const destPath = path.join(appBuildDir, 'node_modules')
  if (!fs.existsSync(destPath)) {
    promiseWrapper(symlinkDir(nodeModulesPath, destPath))
  }
}

export interface IStoreModuleItem {
  namespace: string
  code: string
}
export function getStoreModuleList(appData: IWebRuntimeAppData) {
  const storeModuleList: IStoreModuleItem[] = []
  extractRematchModules(appData.codeModules)
  loopDealWithFn(appData.pageInstanceList, (pageInstance: IPageInstance) => {
    extractRematchModules(pageInstance.codeModules)
  })
  return storeModuleList

  function extractRematchModules(mods: IWeAppCode[]) {
    mods
      .filter(m => m.type === 'rematch')
      .forEach(m => {
        storeModuleList.push({
          namespace: m.name,
          code: m.code,
        })
      })
  }
}

export function fixProcessCwd(appBuilderDir: string) {
  const currentCwd = process.cwd()
  const nodeModulesWaPath = path.resolve(currentCwd, 'node_modules/.bin/wa')
  if (fs.pathExistsSync(nodeModulesWaPath)) {
    return
  }
  appBuilderDir && process.chdir(appBuilderDir)
}
