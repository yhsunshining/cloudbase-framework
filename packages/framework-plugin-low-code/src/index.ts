/**
 * Tencent is pleased to support the open source community by making CloudBaseFramework - 云原生一体化部署工具 available.
 *
 * Copyright (C) 2020 THL A29 Limited, a Tencent company.  All rights reserved.
 *
 * Please refer to license text included with this package for license details.
 */
export * as generator from './generator/core/index';
import fs, { PathLike } from 'fs-extra';
import path from 'path';
import { Plugin, PluginServiceApi } from '@cloudbase/framework-core';
import { plugin as MiniProgramsPlugin } from '@cloudbase/framework-plugin-mp';
import { plugin as WebsitePlugin } from '@cloudbase/framework-plugin-website';
import { plugin as AuthPlugin } from '@cloudbase/framework-plugin-auth';
import { deserializePlatformApp } from '@cloudbase/cals';
import {
  getValidNodeModulesPath,
  processPkgUrlCals2WeappData,
} from './utils/common';
import { default as weAppsBuild } from './builder/core';
import {
  BuildType,
  WebpackModeType,
  GenerateMpType,
  buildAsAdminPortalByBuildType,
  buildAsWebByBuildType,
} from './builder/types/common';
import { IMaterialItem, IPlugin } from './weapps-core';
import { handleMpPlugins } from './generate';
import {
  postprocessDeployExtraJson,
  postprocessProjectConfig,
} from './utils/postProcess';
import { merge } from 'lodash';
import archiver from 'archiver';
import COS from 'cos-nodejs-sdk-v5';
import QRCode from 'qrcode';
import url from 'url';
import { DEPLOY_MODE, RUNTIME, HISTORY_TYPE } from './types';
import { appTemplateDir } from './builder/config';
/**
 * 导出接口用于生成 JSON Schema 来进行智能提示
 */

export const DIST_PATH = './dist';
const DEBUG_PATH = './debug';
const QRCODE_PATH = './qrcode.jpg';
const LOG_FILE = 'build.log';
const DEFAULT_CLOUDFUNCTION_ROOT_NAME = 'cloudfunctions';
const DEFAULT_CLOUDFUNCTION_ROOT_PATH = path.join(
  DEFAULT_CLOUDFUNCTION_ROOT_NAME,
  '/'
);

const enum TIME_LABEL {
  LOW_CODE = 'low code lifetime',
  BUILD = 'build process',
  MP_BUILD = 'build mp plugin',
  WEB_BUILD = 'build web plugin',
  FUNCTION_BUILD = 'build function plugin',
  COMPILE = 'compile',
  DEPLOY = 'DEPLOY',
}

const DEFAULT_INPUTS = {
  _inputFile: 'input.json',
  debug: false,
  runtime: process.env.CLOUDBASE_CIID ? RUNTIME.CI : RUNTIME.NONE,
  appId: 'test',
  buildTypeList: [BuildType.MP],
  generateMpType: GenerateMpType.APP,
  generateMpPath: '',
  subAppSerializeDataList: [],
  dependencies: [],
  plugins: [],
  operationService: {},
  publicPath: './',
  extraData: { isComposite: false, compProps: {} },
  mpAppId: '',
  mpDeployPrivateKey: process.env.mpDeployPrivateKey || '',
  deployOptions: {
    mode: process.env.deployMode || DEPLOY_MODE.PREVIEW,
  },
  calsVersion: 'latest',
  ignoreInstall: false,
};

export interface IFrameworkPluginLowCodeInputs {
  /**
   * json文件指定输入参数
   * 相对于项目根目录相对路径
   * @default "input.json"
   */
  _inputFile?: string;

  debug?: boolean;
  /**
   * 运行环境
   * CI 上传构建产物
   * @default ""
   */
  runtime?: RUNTIME;
  /**
   * 低码应用 appId
   */
  appId: string;
  /**
   * 低码应用描述
   */
  mainAppSerializeData: any;
  /**
   * 低码子包应用描述
   */
  subAppSerializeDataList?: any[];
  /**
   * 低码组件依赖
   */
  dependencies?: IMaterialItem[];
  /**
   * 构建类型
   * @default ["mp"]
   */
  buildTypeList?: BuildType[];
  /**
   * 生成应用类型
   * @default app
   */
  generateMpType?: GenerateMpType;
  /**
   * 小程序 appId
   */
  mpAppId?: string;
  /**
   * 小程序生成路径
   */
  generateMpPath?: string;
  /**
   * 小程序生成插件
   */
  plugins?: IPlugin[];
  /**
   * 小程序部署密钥（需要经过base64编码）
   */
  mpDeployPrivateKey?: string;
  /**
   * 静态资源路径
   */
  publicPath?: string;

  /**
   * 构建属性
   */
  deployOptions: {
    /**
     * 构建类型
     */
    mode: DEPLOY_MODE;
    /**
     * 小程序发布版本
     */
    version?: string;
    /**
     * 小程序发布说明
     */
    description?: string;
    /**
     * 发起构建的小程序
     */
    mpAppId?: string;
    /**
     * 小程序部署密钥（需要经过base64编码）
     */
    mpDeployPrivateKey?: string;
    /**
     * 部署到的目标小程序
     */
    targetMpAppId?: string;
  };

  /**
   * 构建产物上传密钥
   */
  credential?: {
    secretId: string;
    secretKey: string;
    /**
     * 临时密钥时凭证包涵 token
     */
    token?: string;
  };

  /**
   * 构建产物存储桶
   */
  storage?: {
    bucket: string;
    region: string;
  };
  /**
   *
   */
  extraData?: {
    operationService?: Object;
    isComposite: boolean;
    compProps: any;
  };
  /**
   * 低码应用描述的协议版本号
   */
  calsVersion?: string;
  /**
   * 是否忽略安装过程
   */
  ignoreInstall?: boolean;
}

export type ResolvedInputs = IFrameworkPluginLowCodeInputs &
  typeof DEFAULT_INPUTS;

class LowCodePlugin extends Plugin {
  protected _resolvedInputs: ResolvedInputs;
  protected _appPath: string;
  protected _authPlugin;
  protected _miniprogramePlugin;
  protected _webPlugin;
  protected _functionPlugin;
  protected _productBasePath?: string;
  protected _timeMap = {};
  protected _logFilePath?: PathLike;
  protected _domain: any[] = [];
  protected _website: any;
  protected _rules: any;
  protected _skipInstallExt: any;
  constructor(
    public name: string,
    public api: PluginServiceApi,
    public inputs: IFrameworkPluginLowCodeInputs
  ) {
    super(name, api, inputs);
    let inputJSONPath = path.resolve(
      this.api.projectPath,
      inputs._inputFile || DEFAULT_INPUTS._inputFile
    );
    let params = fs.existsSync(inputJSONPath)
      ? fs.readJsonSync(inputJSONPath)
      : {};
    this._resolvedInputs = resolveInputs(
      inputs,
      resolveInputs(params, DEFAULT_INPUTS)
    );

    this._appPath = '';
    this._productBasePath = `lca/${this._resolvedInputs.appId}/${
      process.env.CLOUDBASE_CIID ? `/${process.env.CLOUDBASE_CIID}` : ''
    }`;

    let envId = this.api.envId;
    if (!this._resolvedInputs.mainAppSerializeData) {
      throw new Error('缺少必须参数: mainAppSerializeData');
    }

    if (this._checkIsVersion(this._resolvedInputs.calsVersion)) {
      const cals = this._resolvedInputs.mainAppSerializeData;
      if (!this._resolvedInputs.mainAppSerializeData.mpPkgUrl) {
        this._resolvedInputs.mainAppSerializeData = deserializePlatformApp(
          cals,
          { dependencies: this._resolvedInputs.dependencies }
        );

        if (cals.extra?.miniprogramPlugins) {
          this._resolvedInputs.mainAppSerializeData.miniprogramPlugins = cals.extra.miniprogramPlugins.map(
            (plugin) => {
              return {
                ...plugin,
                componentConfigs:
                  plugin.componentConfigs?.map((component) => {
                    const {
                      data,
                      events,
                      meta = {},
                      ...restComponent
                    } = component;

                    const processedCompoennt = {
                      ...restComponent,
                      meta: {
                        desc: meta?.desc || meta?.description,
                      },
                    };

                    if (data) {
                      processedCompoennt['dataForm'] = data.properties;
                    }

                    if (events) {
                      processedCompoennt['emitEvents'] = events?.map(
                        (event) => ({
                          eventName: event.name,
                          name: event.title,
                        })
                      );
                    }

                    return processedCompoennt;
                  }) || [],
              };
            }
          );
        }
      } else {
        this._resolvedInputs.mainAppSerializeData = processPkgUrlCals2WeappData(
          cals
        );
      }
    }

    if (!this._resolvedInputs.mainAppSerializeData?.envId) {
      this._resolvedInputs.mainAppSerializeData.envId = envId;
    }

    if (buildAsWebByBuildType(this._resolvedInputs.buildTypeList)) {
      const { appId, mainAppSerializeData } = this._resolvedInputs;
      let { appConfig = {} } = mainAppSerializeData;
      let { window = {} } = appConfig;
      let path = this._getWebRootPath();
      window.publicPath = path;
      window.basename = buildAsAdminPortalByBuildType(
        this._resolvedInputs.buildTypeList
      )
        ? `app/${appId}${
            this._resolvedInputs.deployOptions?.mode !== DEPLOY_MODE.UPLOAD
              ? '-preview'
              : ''
          }`
        : path;
      appConfig.window = window;
      this._resolvedInputs.mainAppSerializeData.appConfig = appConfig;
      this._resolvedInputs.subAppSerializeDataList = [];
      // web 构建不处理小程序插件
      if (this._resolvedInputs.mainAppSerializeData.miniprogramPlugins) {
        this._resolvedInputs.mainAppSerializeData.miniprogramPlugins = [];
      }
    } else {
      // 小程序构建
      const {
        mpAppId,
        mpDeployPrivateKey,
        deployOptions,
      } = this._resolvedInputs;

      if (deployOptions.mpAppId === undefined) {
        deployOptions.mpAppId = mpAppId;
      }

      if (deployOptions.mpDeployPrivateKey === undefined) {
        deployOptions.mpDeployPrivateKey = mpDeployPrivateKey;
      }

      if (deployOptions.targetMpAppId === undefined) {
        deployOptions.targetMpAppId = deployOptions.mpAppId;
      }
    }

    this._initDir();

    this.api.logger.debug(`low-code plugin construct at ${Date.now()}`);
    this._time(TIME_LABEL.LOW_CODE);
  }

  _initDir() {
    // 预先创建目录
    fs.emptyDirSync(path.resolve(this.api.projectPath, DIST_PATH));
    fs.removeSync(path.resolve(this.api.projectPath, DEBUG_PATH));
  }

  _subPluginConstructor(resolveInputs: ResolvedInputs) {
    if (resolveInputs.runtime === RUNTIME.CLI) {
      return;
    }

    let { buildTypeList, deployOptions } = resolveInputs;

    this._authPlugin = new AuthPlugin('auth', this.api, {
      configs: [
        {
          platform: 'NONLOGIN',
          status: 'ENABLE',
          platformId: '',
          platformSecret: '',
        },
        {
          platform: 'ANONYMOUS',
          status: 'ENABLE',
          platformId: '',
          platformSecret: '',
        },
      ],
    });

    /**
     * 构建类型相关
     **/
    if (buildTypeList.includes(BuildType.MP)) {
      if (deployOptions.mpDeployPrivateKey) {
        fs.writeFileSync(
          path.join(
            this.api.projectPath,
            `./private.${deployOptions.mpAppId}.key`
          ),
          deployOptions.mpDeployPrivateKey,
          'base64'
        );
      }

      let projectJson = fs.readJsonSync(
        path.resolve(this.api.projectPath, DIST_PATH, 'project.config.json')
      );
      let { cloudfunctionRoot, miniprogramRoot = './' } = projectJson;

      let setting = {
        es6: true,
        es7: true,
        minify: true,
        codeProtect: false,
      };
      this._miniprogramePlugin = new MiniProgramsPlugin(
        'miniprograme',
        this.api as any,
        {
          appid: deployOptions.mpAppId as string,
          privateKeyPath: `./private.${deployOptions.mpAppId}.key`,
          localPath: DIST_PATH,
          ignores: ['node_modules/**/*', LOG_FILE].concat(
            cloudfunctionRoot ? [path.join(cloudfunctionRoot, '**/*')] : []
          ),
          deployMode:
            deployOptions.mpAppId === deployOptions.targetMpAppId
              ? deployOptions.mode
              : DEPLOY_MODE.UPLOAD,
          uploadOptions: {
            version: deployOptions?.version || '1.0.0',
            desc: deployOptions?.description || '',
            setting,
          },
          previewOptions: {
            qrcodeOutputPath: path.resolve(this.api.projectPath, QRCODE_PATH),
            pagePath: fs.readJsonSync(
              path.resolve(
                this.api.projectPath,
                DIST_PATH,
                miniprogramRoot,
                'app.json'
              )
            )?.pages?.[0],
            setting,
          },
        }
      );
    } else if (buildAsWebByBuildType(buildTypeList)) {
      this._webPlugin = new WebsitePlugin('web', this.api, {
        outputPath: DIST_PATH,
        cloudPath: this._getWebRootPath(),
        ignore: [
          '.git',
          '.github',
          'node_modules',
          'cloudbaserc.js',
          LOG_FILE,
          DEFAULT_CLOUDFUNCTION_ROOT_NAME,
        ],
      });
    }
  }

  _getWebRootPath() {
    let { appId, deployOptions } = this._resolvedInputs;
    return deployOptions?.mode === DEPLOY_MODE.PREVIEW
      ? `/${appId}/preview/`
      : `/${appId}/production/`;
  }

  /**
   * 工具方法，console.time 条件封装
   */
  _time(label) {
    if (!this._timeMap[label]) {
      this._timeMap[label] = Date.now();
    }
  }

  /**
   * 工具方法，console.time 条件封装
   */
  _timeEnd(label) {
    let startTime = this._timeMap[label];
    if (startTime) {
      let delta = Date.now() - startTime;
      return parseFloat((delta / 1000).toPrecision(2));
    }
  }

  /**
   * 初始化
   */
  async init() {}

  /**
   * 执行本地命令
   */
  async run() {}

  /**
   * 删除资源
   */
  async remove() {}

  /**
   * 生成代码
   */
  async genCode() {}

  /**
   * 构建
   */
  async build() {
    let { logger } = this.api;
    const staticDir = path.resolve(__dirname, '../../../static');
    let {
      debug,
      mainAppSerializeData,
      subAppSerializeDataList,
      dependencies,
      appId,
      buildTypeList,
      generateMpType,
      generateMpPath,
      plugins,
      publicPath,
      extraData = { isComposite: false, compProps: {} },
      calsVersion,
    } = this._resolvedInputs;

    const webpackMode =
      this._resolvedInputs.deployOptions?.mode === DEPLOY_MODE.UPLOAD
        ? WebpackModeType.PRODUCTION
        : WebpackModeType.NONE;

    // const webpackMode = WebpackModeType.PRODUCTION;

    subAppSerializeDataList = subAppSerializeDataList?.map((item) => {
      if (this._checkIsVersion(calsVersion)) {
        return item.mpPkgUrl
          ? processPkgUrlCals2WeappData(item)
          : deserializePlatformApp(item, { dependencies });
      }
      return item;
    }) as any;

    const nodeModulesPath = getValidNodeModulesPath();

    let miniAppDir = '';
    let webAppDir = '';
    const h5url = `./${appId}/index.html`;

    if (extraData.isComposite) {
      Object.keys(extraData.compProps.events).forEach((eName) => {
        extraData.compProps.events[eName] = `$$EVENT_${eName}$$`;
      });
    }
    try {
      const HostingProvider = this.api.resourceProviders?.hosting;
      const envId = this.api.envId;
      async function getHostingInfo(envId) {
        let [website, hostingDatas] = await HostingProvider.getHostingInfo({
          envId: envId,
        }).then(({ data: hostingDatas }) => {
          let website = hostingDatas[0];
          return [website, hostingDatas];
        });
        if (!website || website?.status !== 'online') {
          await new Promise((resolve) => {
            setTimeout(() => {
              resolve(true);
            }, 8 * 1000);
          });
          return getHostingInfo(envId);
        } else {
          return [website, hostingDatas];
        }
      }
      let timeout: any = null;
      let [website, hostingDatas] = await Promise.race([
        new Promise((resolve) => {
          timeout = setTimeout(() => {
            resolve([]);
          }, 120 * 1000);
        }),
        this._webPlugin?.website
          ? Promise.resolve([this._webPlugin.website])
          : getHostingInfo(envId),
      ]);
      if (timeout) {
        clearTimeout(timeout);
      }

      if (HostingProvider) {
        if (!hostingDatas) {
          hostingDatas = (
            await HostingProvider.getHostingInfo({ envId: envId })
          ).data;
        }
        let domains = hostingDatas.map((item) => item.cdnDomain);
        this._domain = domains; //domains[0].cdnDomain;
      }
      this._website = website;
    } catch (e) {
      this.api.logger.error('获取静态托管失败: ', e);
      throw e;
    }

    try {
      // 构建中间日志暂停输出
      if (!debug) {
        pauseConsoleOutput();
      }

      this._time(TIME_LABEL.BUILD);
      this._appPath = await new Promise(async (resolve, reject) => {
        try {
          await weAppsBuild(
            {
              mainAppSerializeData,
              subAppSerializeDataList,
              dependencies,
              appKey: appId,
              nodeModulesPath,
              publicPath,
              buildTypeList,
              runtime: this._resolvedInputs.runtime,
              ignoreInstall: this._resolvedInputs.ignoreInstall,
              mode: webpackMode,
              deployMode: this._resolvedInputs.deployOptions?.mode,
              watch: false,
              generateMpType,
              generateMpPath,
              isCleanDistDir: false,
              plugins,
              extraData,
              isCrossAccount:
                this._resolvedInputs.mpAppId !==
                this._resolvedInputs.deployOptions?.targetMpAppId,
              resourceAppid: this._resolvedInputs.mpAppId,
              domain: this._domain[0],
            },
            async (err: any, result) => {
              if (!err) {
                try {
                  const { appConfig = {} } = mainAppSerializeData;
                  const { publicPath = '' } = appConfig?.window || {};
                  const { outDir = '', timeElapsed = 0, plugins } =
                    result || {};

                  if (buildTypeList.includes(BuildType.MP)) {
                    miniAppDir = outDir;
                  }

                  if (buildAsWebByBuildType(buildTypeList)) {
                    webAppDir = path.resolve(outDir, 'preview');
                  }

                  logger.debug(
                    `=== Compilation finished at ${outDir}, elapsed time: ${
                      timeElapsed / 1000
                    }s.===\n`
                  );

                  if (buildTypeList.includes(BuildType.MP) && miniAppDir) {
                    let projectJsonPath = path.resolve(
                      miniAppDir,
                      'project.config.json'
                    );

                    await postprocessProjectConfig(projectJsonPath, {
                      appid: this._resolvedInputs.deployOptions.mpAppId,
                      cloudfunctionRoot: undefined,
                    });

                    // 如果是代开发的模式，则写入ext.json
                    await postprocessDeployExtraJson(
                      miniAppDir,
                      this._resolvedInputs.deployOptions
                    );

                    if (generateMpType === GenerateMpType.APP) {
                      // 模板拷入的 miniprogram_npm 有问题，直接删除使用重新构建的版本
                      // 模板需要占位保证 mp 文件夹存在
                      fs.removeSync(
                        path.resolve(miniAppDir, 'miniprogram_npm')
                      );
                    }

                    if (outDir) {
                      // 原生小程序的插件在这里进行插入
                      if (plugins) {
                        await handleMpPlugins(plugins, outDir);
                      }
                    }
                  }
                  // 编译web
                  else if (buildAsWebByBuildType(buildTypeList) && webAppDir) {
                    const staticAppDir = path.join(staticDir, publicPath);
                    fs.ensureDirSync(staticAppDir);
                  }

                  let distPath = path.resolve(this.api.projectPath, DIST_PATH);

                  if (miniAppDir) {
                    fs.copySync(miniAppDir, distPath);
                  } else if (webAppDir) {
                    fs.copySync(webAppDir, distPath);
                  }

                  resolve(distPath);
                } catch (e) {
                  reject(e);
                  throw e;
                }
              } else {
                if (err.length) {
                  let messageList = (err[0] || '').split('\n');
                  let lineIndex = 0;
                  let reg = /node_modules\/\@babel/;

                  messageList.find((str, index) => {
                    if (reg.test(str)) {
                      lineIndex = index;
                      return true;
                    } else {
                      return false;
                    }
                  });
                  if (lineIndex) {
                    messageList = messageList.slice(0, lineIndex);
                  }

                  let error = new Error(messageList.join('\n'));
                  reject(error);
                } else {
                  reject(err);
                }
              }
            }
          );
        } catch (e) {
          reject(e);
        }
      });

      // 回复标准输出
      if (!debug) {
        resumeConsoleOutput();
      }

      logger.info(
        `code generated successfully, cost ${this._timeEnd(
          TIME_LABEL.BUILD
        )}s: ${this._appPath}`
      );
      // 子插件构建
      this._subPluginConstructor(this._resolvedInputs);
      if (this._miniprogramePlugin) {
        this._time(TIME_LABEL.MP_BUILD);
        await this._miniprogramePlugin.init();
        await this._miniprogramePlugin.build();
        logger.debug(
          `miniprograme plugin build cost ${this._timeEnd(
            TIME_LABEL.MP_BUILD
          )}s`
        );
      } else if (this._webPlugin) {
        this._time(TIME_LABEL.WEB_BUILD);
        await this._webPlugin.init();
        await this._webPlugin.build();
        logger.debug(
          `website plugin build cost ${this._timeEnd(TIME_LABEL.WEB_BUILD)}s`
        );
      }
    } catch (e) {
      if (debug) {
        await this._debugInfo();
      }
      if (this._resolvedInputs.runtime === RUNTIME.CI) {
        await this._handleCIProduct();
      }
      logger.info(`low-code build fail: ${e}`);

      throw e;
    }

    logger.info(`low-code build end: ${this._appPath}`);

    return this._appPath;
  }

  async compile() {
    try {
      this._time(TIME_LABEL.COMPILE);

      let res: any = {};

      try {
        await this.api.cloudbaseManager
          .commonService('lowcode', '2021-01-08')
          .call({
            Action: 'UpdateLoginConfig',
            Param: { EnvId: this.api.envId },
          });
        this.api.logger.debug('login config set success');
      } catch (e) {
        this.api.logger.error('设置登录配置失败', e);
      }

      if (this._miniprogramePlugin) {
        res = merge(res, await this._miniprogramePlugin.compile());
      } else if (
        buildAsWebByBuildType(this._resolvedInputs.buildTypeList) &&
        this._webPlugin
      ) {
        const deployContent = [
          ...(this._webPlugin.buildOutput.static || []),
          ...(this._webPlugin.buildOutput.staticConfig || []),
        ];

        await Promise.all(
          deployContent.map((options) => {
            return this.api.cloudbaseManager.hosting.uploadFiles({
              localPath: options.src,
              cloudPath: options.cloudPath,
              ignore: this._webPlugin.resolvedInputs.ignore,
            });
          })
        );
      }

      // 没有 resource 和 config 则不拉起扩展
      if (
        !Object.keys(res.Resources || {}).length &&
        !Object.keys(res.Config || {}).length
      ) {
        this._skipInstallExt = true;
      }

      this.api.logger.info(
        `compile end, cost ${this._timeEnd(TIME_LABEL.COMPILE)}s: `,
        res
      );
      return res;
    } catch (e) {
      if (this._resolvedInputs.debug) {
        await this._debugInfo();
      }

      if (this._resolvedInputs.runtime === RUNTIME.CI) {
        await this._handleCIProduct();
      }

      throw e;
    }
  }

  /**
   * 部署
   */
  async deploy() {
    try {
      this._time(TIME_LABEL.DEPLOY);

      if (this._miniprogramePlugin) {
        await this._miniprogramePlugin.deploy();
      } else if (this._webPlugin) {
        await this._webPlugin.deploy();

        if (buildAsAdminPortalByBuildType(this._resolvedInputs.buildTypeList)) {
          await this._postProcessAdminPortal();
        } else {
          await this._postProcessWebsiteConfig();
        }

        try {
          const link = buildAsAdminPortalByBuildType(
            this._resolvedInputs.buildTypeList
          )
            ? `https://${this._website.cdnDomain}/adminportal/`
            : `https://${
                this._website.cdnDomain +
                this._webPlugin.resolvedInputs.cloudPath
              }`;
          const qrcodeOutputPath = path.resolve(
            this.api.projectPath,
            QRCODE_PATH
          );
          await QRCode.toFile(
            path.resolve(this.api.projectPath, QRCODE_PATH),
            link,
            {
              errorCorrectionLevel: 'M',
              type: 'image/jpeg',
              scale: 12,
              margin: 2,
            }
          );
          this.api.logger.info(`${this.api.emoji('🚀')} 网站部署成功：${link}`);
          this.api.logger.info(
            `${this.api.emoji(
              '🚀'
            )} 网站部署成功, 访问二维码地址：${this.api.genClickableLink(
              url.format({
                protocol: 'file:',
                host: qrcodeOutputPath,
              })
            )}`
          );
        } catch (e) {
          this.api.logger.error('网站部署失败: ', e);
          throw e;
        }
      }

      if (this._skipInstallExt) {
        try {
          await this.api.cloudApi.tcbService.request(
            'CloudBaseCIResultCallback',
            {
              CIID: this.api.ciId,
              TraceId: this.api.ciId,
              Status: 0,
            }
          );
          this.api.logger.debug('回调云项目成功');
        } catch (e) {
          this.api.logger.error(
            '通知云项目状态失败[CloudBaseCIResultCallback]',
            e
          );
        }
      }

      this.api.logger.info(
        `${this.api.emoji('🚀')} low - code deploy end, cost ${this._timeEnd(
          TIME_LABEL.DEPLOY
        )}s`
      );
    } catch (e) {
      throw e;
    } finally {
      this.api.logger.debug(
        `low-code plugin takes ${this._timeEnd(TIME_LABEL.LOW_CODE)}s to run.`
      );
      if (this._resolvedInputs.debug) {
        await this._debugInfo();
      }

      if (this._resolvedInputs.runtime === RUNTIME.CI) {
        await this._handleCIProduct();
      }
    }
    return;
  }

  _checkIsVersion(version) {
    return version === 'latest' || String(version).startsWith('2');
  }

  async _handleCIProduct() {
    try {
      fs.ensureDirSync(path.resolve(this.api.projectPath, DIST_PATH));
      const zipPath = path.resolve(
        this.api.projectPath,
        `${this._resolvedInputs.appId}.zip`
      );
      await this._zipDir(
        path.resolve(this.api.projectPath, DIST_PATH),
        zipPath
      );
      let { credential, storage } = this._resolvedInputs;
      let cos = credential?.token
        ? new COS({
            getAuthorization: function (options, callback) {
              callback({
                TmpSecretId: credential?.secretId || '',
                TmpSecretKey: credential?.secretKey || '',
                XCosSecurityToken: credential?.token || '',
                ExpiredTime: Math.floor(Date.now() / 1000) + 600,
                StartTime: Math.floor(Date.now() / 1000),
              } as any);
            },
          })
        : new COS({
            SecretId: credential?.secretId,
            SecretKey: credential?.secretKey,
          });

      await new Promise((resolve, reject) => {
        cos.putObject(
          {
            Bucket: storage?.bucket || '',
            Region: storage?.region || '',
            Key: `${this._productBasePath}/dist.zip`,
            Body: fs.createReadStream(zipPath),
          },
          function (err, data) {
            if (err) {
              reject(err);
            } else {
              resolve(data);
            }
          }
        );
      });
      fs.removeSync(zipPath);

      if (fs.existsSync(path.resolve(this.api.projectPath, QRCODE_PATH))) {
        await new Promise((resolve, reject) => {
          cos.putObject(
            {
              Bucket: storage?.bucket || '',
              Region: storage?.region || '',
              Key: `${this._productBasePath}/qrcode.jpg`,
              Body: fs.createReadStream(
                path.resolve(this.api.projectPath, QRCODE_PATH)
              ),
            },
            function (err, data) {
              if (err) {
                reject(err);
              } else {
                resolve(data);
              }
            }
          );
        });
      }

      if (this._logFilePath) {
        await new Promise((resolve, reject) => {
          cos.putObject(
            {
              Bucket: storage?.bucket || '',
              Region: storage?.region || '',
              Key: `${this._productBasePath}/${LOG_FILE}`,
              Body: fs.createReadStream(this._logFilePath as PathLike),
            },
            function (err, data) {
              if (err) {
                reject(err);
              } else {
                resolve(data);
              }
            }
          );
        });
      }

      if (
        fs.existsSync(path.resolve(this.api.projectPath, DEBUG_PATH)) &&
        this._resolvedInputs.debug
      ) {
        const zipPath = path.resolve(this.api.projectPath, `debug.zip`);
        await this._zipDir(
          path.resolve(this.api.projectPath, DEBUG_PATH),
          zipPath
        );
        await new Promise((resolve, reject) => {
          cos.putObject(
            {
              Bucket: storage?.bucket || '',
              Region: storage?.region || '',
              Key: `${this._productBasePath}/debug.zip`,
              Body: fs.createReadStream(zipPath),
            },
            function (err, data) {
              if (err) {
                reject(err);
              } else {
                resolve(data);
              }
            }
          );
        });
      }

      this.api.logger.info(`${this.api.emoji('🚀')} 上传制品成功。`);
    } catch (e) {
      this.api.logger.error(`${this.api.emoji('🚀')} 上传制品失败：`, e);
    }
  }

  async _debugInfo() {
    fs.ensureDirSync(path.resolve(this.api.projectPath, DEBUG_PATH));
    let {
      mpDeployPrivateKey,
      deployOptions: { mpDeployPrivateKey: _key, ...restDeployOptions },
      ...rest
    } = this._resolvedInputs;
    fs.writeJSONSync(
      path.resolve(this.api.projectPath, DEBUG_PATH, 'input.json'),
      {
        ...rest,
        deployOptions: {
          ...restDeployOptions,
        },
      },
      { spaces: 2 }
    );
    fs.writeJSONSync(
      path.resolve(this.api.projectPath, DEBUG_PATH, 'env.json'),
      process.env,
      { spaces: 2 }
    );
  }

  async _zipDir(src, dist) {
    return new Promise((resolve, reject) => {
      // create a file to stream archive data to.
      var output = fs.createWriteStream(dist);
      var archive = archiver('zip', {
        zlib: { level: 9 }, // Sets the compression level.
      });
      output.on('close', resolve);
      archive.on('error', reject);
      archive.directory(src, false);
      archive.pipe(output);
      archive.finalize();
    });
  }

  async _postProcessAdminPortal() {
    const {
      appId,
      buildTypeList,
      mainAppSerializeData,
      deployOptions,
    } = this._resolvedInputs;
    if (buildAsAdminPortalByBuildType(buildTypeList)) {
      try {
        const isPreview = deployOptions?.mode === DEPLOY_MODE.PREVIEW;
        const id = isPreview ? `${appId}-preview` : appId;
        let name = mainAppSerializeData?.label || appId;
        name = isPreview ? `${name}-预览` : name;

        const params = {
          ID: id,
          Name: name,
          EnvId: this.api.envId,
          DeployUrl: `https://${path.join(
            this._website.cdnDomain,
            this._getWebRootPath()
          )}`,
          Pages: (mainAppSerializeData?.pageInstanceList || [])
            .filter((page) => !page.hideAdminPortalMenu)
            .map((page) => ({
              ID: page.id,
              Title: page.data?.title?.value || page.id,
              Path: `/${page.id}`,
            })),
        };
        await this.api.cloudbaseManager
          .commonService('lowcode', '2021-01-08')
          .call({
            Action: 'CreateRouter',
            Param: params,
          });
        this.api.logger.info('门户路由成功');
      } catch (e) {
        this.api.logger.error('门户路由注册失败: ', e);
      }
    }
  }

  async _postProcessWebsiteConfig() {
    const hostingService = this.api.cloudbaseManager.hosting;
    try {
      let domains = this._domain;
      let { Domains: domainList } = await hostingService.tcbCheckResource({
        domains,
      });
      // hostingService.getInfo();
      let historyType =
        this._resolvedInputs.mainAppSerializeData?.historyType ||
        this._resolvedInputs.buildTypeList.includes(BuildType.APP) ||
        this._resolvedInputs.buildTypeList.includes(BuildType.ADMIN_PORTAL)
          ? HISTORY_TYPE.HASH
          : '';
      if (this._website) {
        if (!historyType || historyType === HISTORY_TYPE.BROWSER) {
          let {
            WebsiteConfiguration,
          } = await hostingService.getWebsiteConfig();
          let path = this._getWebRootPath();
          let rules = (WebsiteConfiguration.RoutingRules || []).reduce(
            (arr, rule) => {
              let meta: any = {};
              let { Condition, Redirect } = rule;
              if (Condition.HttpErrorCodeReturnedEquals) {
                meta.httpErrorCodeReturnedEquals =
                  Condition.HttpErrorCodeReturnedEquals;
              }
              if (Condition.KeyPrefixEquals) {
                meta.keyPrefixEquals = Condition.KeyPrefixEquals;
              }
              if (Redirect.ReplaceKeyWith) {
                meta.replaceKeyWith = Redirect.ReplaceKeyWith;
              }
              if (Redirect.ReplaceKeyPrefixWith) {
                meta.replaceKeyPrefixWith = Redirect.ReplaceKeyPrefixWith;
              }
              if (`/${meta.keyPrefixEquals}`.startsWith(path)) {
                return arr;
              }
              if (meta.httpErrorCodeReturnedEquals !== '404') {
                arr.push(meta);
              }
              return arr;
            },
            []
          );
          this._resolvedInputs.mainAppSerializeData.pageInstanceList?.forEach(
            (page) => {
              rules.push({
                keyPrefixEquals: `${path.slice(1)}${page.id}`,
                replaceKeyWith: path,
              });
            }
          );
          this._rules = rules;
        }
      } else {
        throw new Error('检查静态托管开通超时');
      }
      let modifyDomainConfigPromises = domainList
        .filter((item) => item.DomainConfig.FollowRedirect !== 'on')
        .map((item) =>
          hostingService.tcbModifyAttribute({
            domain: item.Domain,
            domainId: item.DomainId,
            domainConfig: { FollowRedirect: 'on' } as any,
          })
        );
      await Promise.all(modifyDomainConfigPromises);
      await hostingService.setWebsiteDocument({
        indexDocument: 'index.html',
        routingRules: this._rules,
      });
    } catch (e) {
      this.api.logger.error('网站路由注册失败: ', e);
      throw e;
    }
  }
}

function resolveInputs(inputs: any, defaultInputs: any) {
  return Object.assign({}, defaultInputs, inputs);
}

const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalStderrWrite = process.stderr.write.bind(process.stderr);
let previousStdoutWrite = process.stdout.write.bind(process.stdout);
let previousStderrWrite = process.stderr.write.bind(process.stderr);
// 暂停控制台输出
function pauseConsoleOutput() {
  previousStdoutWrite = process.stdout.write;
  process.stdout.write = () => {
    return true;
  };
  previousStderrWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = () => {
    return true;
  };
}
// 恢复控制台输出
function resumeConsoleOutput(original = false) {
  if (original) {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  } else {
    process.stdout.write = previousStdoutWrite;
    process.stderr.write = previousStderrWrite;
  }
}

export const plugin = LowCodePlugin;
