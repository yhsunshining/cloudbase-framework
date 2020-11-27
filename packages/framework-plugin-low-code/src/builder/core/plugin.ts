import { IPlugin } from '../../weapps-core'
import {
  installKbonePlugin,
  installMpPlugin,
  mergeKbonePluginConfig,
} from '../service/builder/plugin'

/**
 * 安装小程序插件
 * @param appBuildDir
 * @param plugins
 */
export async function runHandleMpPlugin(appBuildDir: string, plugins: IPlugin[]) {
  console.time('runHandleMpPlugin')
  await installMpPlugin(appBuildDir, plugins)
  console.timeEnd('runHandleMpPlugin')
}

// 安装 Kbone 插件
export async function runHandleKbonePlugin(appBuildDir: string, plugins: IPlugin[], mpConfig: any) {
  console.time('runHandleKbonePlugin')
  await installKbonePlugin(appBuildDir, plugins)
  await mergeKbonePluginConfig(appBuildDir, plugins, mpConfig)
  console.timeEnd('runHandleKbonePlugin')
}
