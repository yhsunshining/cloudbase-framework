import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from 'path'
import { getValidNodeModulesPath } from './utils'

import { Plugin, PluginServiceApi } from "@cloudbase/framework-core";
import { default as weAppsBuild, buildAsWebByBuildType } from './builder'

/**
 * 导出接口用于生成 JSON Schema 来进行智能提示
 */
export interface IFrameworkPluginLowCodeInputs { }

class LowCodePlugin extends Plugin {
  constructor(
    public name: string,
    public api: PluginServiceApi,
    public inputs: IFrameworkPluginLowCodeInputs
  ) {
    super(name, api, inputs);
  }

  /**
   * 初始化
   */
  async init() { }

  async compile() { }

  /**
   * 执行本地命令
   */
  async run() { }

  /**
   * 删除资源
   */
  async remove() { }

  /**
   * 生成代码
   */
  async genCode() {

  }

  /**
   * 构建
   */
  async build() {
    const staticDir = path.resolve(__dirname, '../../../static')
    const {
      mainAppSerializeDataStr,
      subAppSerializeDataStrList,
      dependencies,
      appId = 'test',
      buildTypeList = ['mp'],
      webpackMode = 'none',
      generateMpType = 'app',
      generateMpPath = '',
      plugins = [],
      operationService = {},
      publicPath: originPublicPath,
      extraData = { isComposite: false, compProps: {} },
    } = ctx.request.body
    const mainAppSerializeData = JSON.parse(mainAppSerializeDataStr)
    const subAppSerializeDataList = subAppSerializeDataStrList.map(item => JSON.parse(item))
    const nodeModulesPath = getValidNodeModulesPath()
    const publicPath = originPublicPath || `./`

    let miniAppDir = ''
    let webAppDir = ''
    const h5url = `http://${getIPAdress()}:${port}/${appId}/index.html`

    if (extraData.isComposite) {
      Object.keys(extraData.compProps.events).forEach(eName => {
        extraData.compProps.events[eName] = `$$EVENT_${eName}$$`
      })
    }
    // 运营平台配置信息
    extraData.operationService = operationService

    const appBuildDir = await weAppsBuild(
      {
        mainAppSerializeData,
        subAppSerializeDataList,
        dependencies,
        appKey: appId,
        nodeModulesPath,
        publicPath,
        buildTypeList,
        mode: webpackMode,
        watch: false,
        generateMpType,
        generateMpPath,
        isCleanDistDir,
        plugins,
        extraData,
      },
      async (err: any, stats: any, { appBuildDir, plugins = [] }: any) => {
        isCleanDistDir = false
        if (!err) {
          const outputPath = stats.compilation.outputOptions.path
          console.log(
            `==== Compilation finished at ${outputPath}, elapsed time: ${(stats.endTime -
              stats.startTime) /
            1000}s.====\n`
          )
          if (miniAppDir && outputPath.includes(miniAppDir)) {
            let openIdeDir = miniAppDir

            // 打开开发者工具的目录切换为主程序目录
            if (generateMpType === 'subpackage' && generateMpPath) {
              openIdeDir = generateMpPath
              await copySubpackageToApp(appBuildDir, appId, generateMpPath)
            }

            // 原生小程序的插件在这里进行插入
            if (plugins) {
              await handleMpPlugins(plugins, appBuildDir)
            }

            // 小程序构建 npm
            await buildNpm(openIdeDir)
            // 打开开发者工具
            const isSuccess = await openIde(openIdeDir)
            if (!isSuccess) {
              error(`请使用微信开发者工具手动打开项目，路径：${openIdeDir}`)
            }
          }
          // 编译web
          if (buildAsWebByBuildType(buildTypeList) && webAppDir) {
            const staticAppDir = path.join(staticDir, publicPath)
            fs.ensureDirSync(staticAppDir)
            if (webpackMode !== 'production') {
              if (!startWebDevServer.get(appId)) {
                const devConfig = devServerConf
                const params = devConfig ? ['--devServerConf', devConfig] : []
                const devServerPath = path.resolve(appBuildDir, './webpack/devServer.js')
                info(`start node ${devServerPath} --devServerConf ${devConfig}....`)
                const env = process.env
                env.NODE_PATH = appBuildDir
                console.log('spawn env 环境：', env.NODE_PATH)
                const ls = spawn('node', [devServerPath, ...params], {
                  env,
                })
                startWebDevServer.set(appId, true)
                ls.stdout.on('data', data => {
                  info(`${data}`, 'devServer stdout:')
                  if (data.includes('dev server listening on port 8001')) {
                    startWebDevServer.set(appId, true)
                  }
                })

                ls.stderr.on('data', data => {
                  error(`${data}`, 'devServer strerr:')
                })

                ls.on('close', code => {
                  error(`子进程退出，退出码 ${code}`)
                })
              }
            } else {
              await promisify(symlinkDir(webAppDir, staticAppDir + '/' + appId))
              openBrowser(h5url)
            }
          }
        }
      }
    )

    console.log('appBuildDir', appBuildDir)

    if (buildTypeList.includes('mp')) {
      miniAppDir = path.resolve(appBuildDir, 'dist/mp')
    }

    if (buildAsWebByBuildType(buildTypeList)) {
      webAppDir = path.resolve(appBuildDir, 'preview')
    }

    ctx.body = {
      errcode: 0,
      data: {
        webAppDir,
        miniAppDir,
        url: h5url,
      },
    }
    return miniAppDir

  }

  /**
   * 部署
   */
  async deploy() { }
}

export const plugin = LowCodePlugin;
