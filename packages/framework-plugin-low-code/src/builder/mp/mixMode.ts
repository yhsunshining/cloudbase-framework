import { IWeAppData, IPlugin, IMaterialItem } from '../../weapps-core'
import path from 'path'
import fs, { lstatSync } from 'fs-extra'
import { mergeSubPackages, mergePackageJson, mergePages } from '../util/mp'
import { installDep } from '../core'
import { getPluginType } from '../service/builder/plugin'
import { IAppUsedComp } from '../types/common'
import _ from 'lodash'
import chalk from 'chalk'

// 将 BUILD 目录往混合模式移动
export async function handleMixMode({
  apps = [],
  generateMpPath,
  appBuildDir,
  plugins = [],
}: {
  apps: IWeAppData[]
  generateMpPath: string
  appBuildDir: string
  plugins: IPlugin[]
}) {
  await handleMainApp()
  await handleAppPages()
  await handleSubApps()

  await handleAppJson()
  await handlePkgJson()
  await installDep(generateMpPath)
  await handlePlugins()

  // 复制框架公用内容
  async function handleMainApp() {
    // 可以独立删除的
    const aloneDirs = ['common', 'app', 'lowcode', 'materials']
    // 与主程序混合不能主动删除的
    const dirs = aloneDirs
    await Promise.all(
      dirs.map(async (dirname) => {
        const srcDir = path.join(appBuildDir, dirname)
        if (await fs.pathExists(srcDir)) {
          const distDir = path.join(generateMpPath, dirname)
          if (aloneDirs.includes(dirname)) {
            await fs.remove(distDir)
          }
          await fs.copy(srcDir, distDir)
        }
      })
    )
  }

  // 复制主包的页面，需要判断是否有冲突
  async function handleAppPages() {
    // 需要特殊处理的
    const srcDir = path.join(appBuildDir, 'pages')
    const distDir = path.join(generateMpPath, 'pages')
    const pageList = await fs.readdir(srcDir)

    await Promise.all(
      pageList.map(async (page) => {
        const srcPageDir = path.join(srcDir, page)
        const srcDistDir = path.join(distDir, page)
        if (await fs.pathExists(srcDistDir)) {
          console.log(
            chalk.yellow(
              `【混合模式】 WeApps 中的 pages/${page} 与小程序 pages/${page} 重复，会以 WeApps 的为主`
            )
          )
        }

        await fs.copy(srcPageDir, srcDistDir)
      })
    )
  }

  // 复制整个子包
  async function handleSubApps() {
    return Promise.all(
      apps
        .filter((app) => app.rootPath)
        .map(async (app) => {
          const subAppPath = path.join(appBuildDir, app.rootPath || '')
          const distDir = path.join(generateMpPath, app.rootPath || '')
          await fs.copy(subAppPath, distDir, { overwrite: true })
        })
    )
  }

  // 复制插件
  async function handlePlugins() {
    const mpPlugins = (await getPluginType(generateMpPath, plugins)).filter(
      (item) => item.type === 'mp'
    )
    return Promise.all(
      mpPlugins.map(async (plugin) => {
        const pluginModule = plugin.module
        const pluginNodeModuleDir = path.resolve(
          generateMpPath,
          'node_modules',
          pluginModule
        )
        const pluginPkgJson = await fs.readJson(
          path.join(pluginNodeModuleDir, 'package.json')
        )
        const { pluginName } = pluginPkgJson
        const pluginDir = path.join(appBuildDir, pluginName)
        const distDir = path.join(generateMpPath, pluginName)
        await fs.copy(pluginDir, distDir, { overwrite: true })
      })
    )
  }

  async function handleAppJson() {
    const baseAppJsonPath = path.join(generateMpPath, 'app.json')
    const mergeAppJsonPath = path.join(appBuildDir, 'app.json')
    await mergePages(baseAppJsonPath, mergeAppJsonPath)
    await mergeSubPackages(baseAppJsonPath, mergeAppJsonPath)
  }

  async function handlePkgJson() {
    const basePkgJsonPath = path.join(generateMpPath, 'package.json')
    const mergePkgJsonPath = path.join(appBuildDir, 'package.json')
    await mergePackageJson(basePkgJsonPath, mergePkgJsonPath)
  }
}

// 子模式则清理未使用的组件库
export async function handleMixMaterials(
  projDir: string,
  apps: IWeAppData[],
  appUsedComps: IAppUsedComp[],
  compositedLibs: IMaterialItem[]
) {
  return Promise.all(
    apps.map(async (app) => {
      const rootPath = app.rootPath || ''
      const materialsDirPath = path.join(projDir, rootPath, 'materials')
      const usedComps =
        appUsedComps.find((item) => item.rootPath === rootPath)?.usedComps || {}
      const materialsLib = await readDirs(materialsDirPath)

      // 清理未使用的组件库
      const cleanLibs = _.difference(materialsLib, Object.keys(usedComps))
      await removeDirs(
        cleanLibs.map((libName) => path.join(materialsDirPath, libName))
      )

      // 清理未使用的组件
      await Promise.all(
        Object.keys(usedComps).map(async (libName) => {
          // 只去处理复合组件
          if (!compositedLibs.find((item) => item.name === libName)) {
            return
          }

          const libComponents = usedComps[libName]
          const materialsLibComps = await readDirs(
            path.join(materialsDirPath, libName)
          )
          const cleanComps = _.difference(
            materialsLibComps,
            Array.from(libComponents)
          )
          await removeDirs(
            cleanComps.map((compName) =>
              path.join(materialsDirPath, libName, compName)
            )
          )
        })
      )
    })
  )
}

async function removeDirs(dirs: string[]) {
  return Promise.all(
    dirs.map((dir) => {
      console.log('【MIX MODE 清理】', dir)
      return fs.remove(dir)
    })
  )
}

// 只返回文件夹
async function readDirs(dirPath: string) {
  const isDirectory = (source: string) => lstatSync(source).isDirectory()
  return ((await fs.readdir(dirPath)) || []).filter((name) =>
    isDirectory(path.join(dirPath, name))
  )
}
