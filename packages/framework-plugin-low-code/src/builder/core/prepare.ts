import fs from 'fs-extra'
import path from 'path'
import {
  BuildType,
  WebpackBuildCallBack,
  buildAsWebByBuildType,
} from '../types/common'
import * as junk from '../util/junk'

export async function runPrepare(
  buildTypeList: BuildType[],
  appBuildDir: string,
  isCleanDistDir: boolean
) {
  console.time('runPrepare')
  const projectConfig = await saveProjectConfigJson(appBuildDir)
  try {
    if (buildTypeList.includes(BuildType.MP)) {
      const mpDirPath = path.resolve(appBuildDir, './dist/mp')
      if (projectConfig && projectConfig.cloudfunctionRoot) {
      } else {
        await fs.emptyDir(mpDirPath)
      }
      const dirs = fs.readdirSync(mpDirPath).filter(junk.not)
      await Promise.all(
        dirs.map(async (dir) => {
          // 云函数特殊处理，不删除
          if (projectConfig && projectConfig.cloudfunctionRoot) {
            if (projectConfig.cloudfunctionRoot.startsWith(dir)) {
              return
            }
          }

          // miniprogram_npm 不删除，删除会出现被占用删不掉，导致写不进去，打开小程序异常
          if (dir === 'miniprogram_npm') {
            return
          }

          await fs.remove(path.resolve(mpDirPath, dir))
        })
      )
    }

    if (buildAsWebByBuildType(buildTypeList)) {
      await fs.emptyDir(path.resolve(appBuildDir, './preview'))
    }
  } catch (e) {
    console.error('清空 dist/preview 目录失败', e)
  }
  if (isCleanDistDir) {
    await fs.remove(path.resolve(appBuildDir, './src'))
    await fs.remove(path.resolve(appBuildDir, './webpack'))
    await fs.remove(path.resolve(appBuildDir, './package-lock.json'))
    await fs.remove(path.resolve(appBuildDir, './yarn.lock'))
  }
  await fs.ensureDir(appBuildDir)
  console.timeEnd('runPrepare')
  return projectConfig
}

export async function saveProjectConfigJson(appBuildDir: string) {
  const projectConfigJsonPath = path.resolve(
    appBuildDir,
    './dist/mp/project.config.json'
  )
  if (fs.existsSync(projectConfigJsonPath)) {
    return await fs.readJSON(projectConfigJsonPath)
  }
  return null
}

export function createDoneCallBack(
  { projectConfig, appBuildDir },
  cb
): WebpackBuildCallBack {
  return async (...params) => {
    if (projectConfig) {
      const newProjectConfig: any = await saveProjectConfigJson(appBuildDir)
      if (newProjectConfig) {
        newProjectConfig.condition = projectConfig.condition
        const projectConfigJsonPath = path.resolve(
          appBuildDir,
          './dist/mp/project.config.json'
        )
        await fs.writeFile(
          projectConfigJsonPath,
          JSON.stringify(newProjectConfig, null, 4),
          {
            encoding: 'utf8',
          }
        )
      }
    }
    cb && cb(...params)
  }
}
