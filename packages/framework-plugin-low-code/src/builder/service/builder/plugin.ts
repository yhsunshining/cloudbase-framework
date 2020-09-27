import * as fs from 'fs-extra'
import { IPlugin } from '../../../weapps-core'
import * as path from 'path'

// 安装原生小程序类的插件
export async function installMpPlugin(appBuildDir: string, plugins: IPlugin[]) {
  return Promise.all(
    plugins
      .filter(item => item.type === 'mp')
      .map(async plugin => {
        const pluginModule = plugin.module
        const pluginNodeModuleDir = path.resolve(appBuildDir, 'node_modules', pluginModule)
        const pluginPkgJson = await fs.readJson(path.join(pluginNodeModuleDir, 'package.json'))
        const { pluginName } = pluginPkgJson

        const pluginNodeModuleSrcDir = path.resolve(pluginNodeModuleDir, pluginName)
        const mpBuildPluginDir = path.resolve(appBuildDir, 'dist/mp', pluginName)

        // 将插件目录复制到项目里
        console.log('安装 mp 插件', pluginModule)
        await fs.copy(pluginNodeModuleSrcDir, mpBuildPluginDir, {
          overwrite: true,
        })
      })
  )

  // 这里的 mergeAppJson 是不生效的，只能到 wa-watch 里 merge
  // GOTO webpack compile callback
}

// kbone 类小程序插件
export async function installKbonePlugin(appBuildDir: string, plugins: IPlugin[]) {
  return Promise.all(
    plugins
      .filter(item => item.type === 'kbone')
      .map(async plugin => {
        const pluginName = plugin.name
        const pluginPackage = `@govcloud/${pluginName}`
        const pluginNodeModuleDir = path.resolve(appBuildDir, 'node_modules', pluginPackage)
        const pluginNodeModuleSrcDir = path.resolve(pluginNodeModuleDir, 'src')
        const mpBuildPluginDir = path.resolve(appBuildDir, 'src', pluginName)

        // 将插件目录复制到项目里
        console.log('安装 kbone 插件', plugin.name)
        try {
          await fs.copy(pluginNodeModuleSrcDir, mpBuildPluginDir, {
            overwrite: true,
          })
        } catch (e) {
          console.error('安装插件失败', plugin.name, e)
        }
      })
  )
}

/**
 * 获取 kbone plugin 的 entry
 * 用于合并到生成前的 webpack config 的 entry 中
 */
export async function getKbonePluginEntry(appBuildDir: string, plugins: IPlugin[]) {
  const entry = {}

  // 异步循环，使用 for...of...
  for (const plugin of plugins) {
    if (plugin.type === 'kbone') {
      const pluginName = plugin.name
      const pluginDir = path.resolve(appBuildDir, 'src', pluginName)
      const pagesDir = path.resolve(pluginDir, 'pages')
      const dirs = await fs.readdir(pagesDir)

      await Promise.all(
        dirs.map(async dir => {
          const entryPath = path.resolve(pagesDir, dir, 'main.mp.jsx')
          if (await fs.pathExists(entryPath)) {
            entry[`${pluginName}__${dir}`] = entryPath
          }
        })
      )
    }
  }

  return entry
}

/**
 * 获取 kbone 插件的 subpackages
 */
export async function getPluginKboneSubpackage(appBuildDir: string, plugins: IPlugin[]) {
  // 异步循环，使用 for...of...
  const subpackages = {}
  for (const plugin of plugins) {
    debugger
    if (plugin.type === 'kbone') {
      const pluginName = plugin.name
      const entrys = await getKbonePluginEntry(appBuildDir, plugins)
      subpackages[pluginName] = Object.keys(entrys).filter(entryPath =>
        entryPath.includes(pluginName)
      )
    }
  }
  return subpackages
}

/**
 * 根据 plugin 获取插件类型
 * @param appBuildDir 编译的目录
 * @param plugins 插件列表
 */
export async function getPluginType(appBuildDir: string, plugins: IPlugin[]) {
  const pluginsWithType: any[] = []
  for (const plugin of plugins) {
    const pluginName = plugin.name
    // TODO: @govcloud 是在私域里，后续需要接入配置修改
    const pkgPath = path.resolve(appBuildDir, `node_modules/@govcloud/${pluginName}/package.json`)
    const pkgJson = await fs.readJson(pkgPath)
    pluginsWithType.push({
      ...plugin,
      type: pkgJson.pluginType || 'kbone',
    })
  }
  return pluginsWithType
}

// 合并 Kbone 插件的 mp_config 配置
export async function mergeKbonePluginConfig(
  appBuildDir: string,
  plugins: IPlugin[],
  mpConfig: any
) {
  console.time('mergeKbonePluginConfig')

  for (const plugin of plugins) {
    const pluginName = plugin.name
    const mpConfigPath = path.resolve(
      appBuildDir,
      `node_modules/@govcloud/${pluginName}/scripts/miniprogram.config.js`
    )
    const pluginMpConfig = require(mpConfigPath)

    // plugin 的 app/pages 的配置合并
    const pluginAppConfig = pluginMpConfig.app
    pluginMpConfig.generate.subpackages[pluginName].forEach((pluginPage: string) => {
      if (!mpConfig.pages) mpConfig.pages = {}

      // App 优先，Page 用于覆盖
      mpConfig.pages[pluginPage] = {
        extra: {
          ...pluginAppConfig,
          ...(pluginMpConfig?.pages || {})[pluginPage]?.extra,
        },
      }
    })

    return mpConfig
  }

  console.timeEnd('mergeKbonePluginConfig')
}
