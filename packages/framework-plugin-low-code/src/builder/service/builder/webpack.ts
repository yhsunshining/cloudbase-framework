import path from 'path';
import fs from 'fs-extra';
import webpack from 'webpack';
import tpl from 'lodash.template';
import {
  getCurrentPackageJson,
  promiseWrapper,
  removeRequireUncached,
  requireUncached,
} from '../../util';
import { promisifyProcess } from '../../util/process';
import axios from 'axios';
import compressing from 'compressing';
import spawn from 'cross-spawn';
import {
  IMaterialItem,
  IPageInstance,
  IWebRuntimeAppData,
  IPlugin,
  loopDealWithFn,
} from '../../../weapps-core';
import {
  MP_CONFIG_MODULE_NAME,
  KBONE_PAGE_KEYS,
  npmRegistry,
} from '../../config';
import { getPluginKboneSubpackage } from './plugin';
import { sync as commandExistsSync } from 'command-exists';
import { getFileNameByUrl } from '../../util/common';
import {
  BuildType,
  WebpackModeType,
  WebpackBuildCallBack,
  buildAsAdminPortalByBuildType,
} from '../../types/common';
import { appTemplateDir } from '../../config';
import { notice } from '../../util/console';
import { HISTORY_TYPE, RUNTIME } from '../../../types';
import { CLOUD_SDK_FILE_NAME } from '../../../index';
const yarnExists = commandExistsSync('yarn');

export interface IMpConfig {
  origin: string;
  entry: string;
  router: Record<string, string[]>;
  redirect: {
    notFound: string;
    accessDenied: string;
  };
  generate: {
    app: 'default' | 'noemit' | 'noconfig';
    appEntry?: string;
    subpackages?: Record<string, string[]>;
  };
  runtime: {
    wxComponent: 'default' | 'noprefix';
  };
  app: {
    navigationBarTitleText?: string;
  };
  projectConfig: {
    appid: string;
    projectname: string;
  };
  packageConfig: {
    author: string;
  };
}

const runningCompilations: { [key: string]: webpack.Compiler.Watching } = {};

export interface ICompileOpts {
  configPath: string;
  appBuildDir: string;
  appKey: string;
  generateMpType?: 'app' | 'subpackage';
  generateMpPath?: string;
  plugins?: IPlugin[];
}
export function startCompile(options: ICompileOpts, cb: WebpackBuildCallBack) {
  const key = options.configPath;
  const runningProcess = runningCompilations[key];
  if (runningProcess) {
    console.log(`Compiling ${options.configPath} already running`);
    return;
  }
  console.log('Running webpack by ' + options.configPath);
  removeRequireUncached(
    path.resolve(options.configPath, '../miniprogram.config.js')
  );
  const watching = webpack(
    requireUncached(options.configPath),
    async (err: any, stats) => {
      if (err) {
        console.error('webpack config error', err.stack || err);
        if (err.details) {
          console.error('webpack config error detail', err.details);
        }
        cb?.(err);
        delete runningCompilations[key];
        return;
      }

      const info = stats.toJson('minimal');

      if (stats.hasErrors()) {
        console.error('Webpack compilation errors', info.errors.join('\n'));
        cb?.(info.errors);
      } else {
        let { endTime = 0, startTime = 0 } = stats;
        cb?.(null, {
          outDir: options.appBuildDir,
          timeElapsed: endTime - startTime,
        });
      }

      if (stats.hasWarnings()) {
        console.warn('webpack compiling warnings', info.warnings.join('\n'));
      }
    }
  );
  if (!(watching instanceof webpack.Compiler)) {
    runningCompilations[key] = watching;
  }
}

export async function fixAppJson(appBuildDir: string) {
  const appJsonPath = path.resolve(appBuildDir, 'dist/mp/app.json');
  if (!fs.existsSync(appJsonPath)) {
    return;
  }
  const appJson = await fs.readJSON(appJsonPath);
  appJson.subpackages = appJson.subpackages.map((config: any) => {
    config.pages = config.pages.map((pagePath: any) => {
      const pagePathArr = pagePath.split('/');
      if (pagePathArr.length === 4 && pagePathArr[1] === config.root) {
        pagePathArr.splice(1, 1);
        return pagePathArr.join('/');
      }
      return pagePath;
    });
    return config;
  });
  await fs.writeFile(appJsonPath, JSON.stringify(appJson, null, 2));
}

export async function generateWebpackWebBuildParamsFile({
  allAppDataList,
  appBuildDir,
  materialsDir,
  dependencies = [],
  nodeModulesPath,
  publicPath,
  mode,
  watch,
  buildTypeList,
  assets = [],
}: {
  allAppDataList: IWebRuntimeAppData[];
  appBuildDir: string;
  materialsDir: string;
  dependencies: IMaterialItem[];
  nodeModulesPath: string;
  publicPath?: string;
  mode: WebpackModeType;
  watch: boolean;
  buildTypeList: BuildType[];
  assets: string[];
}) {
  let mainAppData = getMainAppDataByList(allAppDataList);
  let extraDefine = {
    'process.env.historyType': `"${
      (mainAppData as any).historyType || HISTORY_TYPE.BROWSER
    }"`,
  };
  const params = getWebpackWebBuildParams(
    appBuildDir,
    materialsDir,
    dependencies,
    nodeModulesPath,
    publicPath,
    mode,
    watch,
    buildTypeList,
    extraDefine,
    assets
  );
  const webpackConfigPath = path.resolve(
    appBuildDir,
    './webpack/webpack.web.prod.js'
  );
  const paramsString = JSON.stringify(params, null, 2);
  const webpackConfigContent = `const params = ${paramsString};\nmodule.exports = require('./web.prod.js')(params);`;
  await fs.writeFile(webpackConfigPath, webpackConfigContent);
  return webpackConfigPath;
}
export interface IGenerateMpJsonConfigFileOpts {
  appKey?: string;
  generateMpType: 'app' | 'subpackage';
}

export async function extractAndRemoveKbConfig(
  mainAppData: IWebRuntimeAppData,
  subAppDataList: IWebRuntimeAppData[],
  appBuildDir: string
) {
  let originMpConfig = {};

  // 如果有 mp_config 则读取内容合并。
  const configMod = mainAppData.codeModules.find(
    (p) => p.name === MP_CONFIG_MODULE_NAME
  );
  if (configMod) {
    const code = configMod.code.replace(/export\s+default/, '');
    try {
      originMpConfig = eval(`(${code})`);
    } catch (e) {
      console.error('Kbone config file error', e);
    }
  }

  // app 配置
  generateKboneAppConfig(originMpConfig, mainAppData);
  // 页面配置
  originMpConfig = generateKbonePageConfig(
    originMpConfig,
    mainAppData,
    subAppDataList
  );
  // tabbar 配置
  await generateKboneTabBarConfig(originMpConfig, appBuildDir);

  return originMpConfig;
}

export async function generateKboneTabBarConfig(
  mpConfig: Record<string, any>,
  appBuildDir
) {
  mpConfig.appExtraConfig = mpConfig.appExtraConfig || {};
  if (mpConfig.appExtraConfig.tabBar) {
    if (mpConfig.appExtraConfig.tabBar.list) {
      await Promise.all(
        mpConfig.appExtraConfig.tabBar.list.map(async (item: any) => {
          if (item.iconPath) {
            item.iconPath = await downloadAndWriteTabBarIcon(
              item.iconPath,
              item.pagePath,
              appBuildDir,
              'iconPath'
            );
          }
          if (item.selectedIconPath) {
            item.selectedIconPath = await downloadAndWriteTabBarIcon(
              item.selectedIconPath,
              item.pagePath,
              appBuildDir,
              'selectedIconPath'
            );
          }
        })
      );
    }
  }
}

export async function downloadAndWriteTabBarIcon(
  iconPath,
  pagePath,
  appBuildDir: string,
  fileName: string
) {
  console.log('开始下载文件', iconPath);
  const extname = path.extname(iconPath);
  const relativePath = `images_tabBar/${pagePath}/${fileName}${extname}`;
  const fileFullPath = path.resolve(appBuildDir, `dist/mp/${relativePath}`);
  await fs.ensureFile(fileFullPath);
  const writer = fs.createWriteStream(fileFullPath);
  const response = await axios({
    method: 'get',
    url: iconPath,
    responseType: 'stream',
  });
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', () => {
      console.log('下载成功', iconPath);
      // copy 一份到web
      // fs.copy(
      //   fileFullPath,
      //   path.resolve(appBuildDir, `preview/${relativePath}`)
      // )
      resolve(relativePath);
    });
    writer.on('error', () => {
      console.error('下载失败', iconPath);
      reject();
    });
  });
}

// 将 weapps 配置的 page-data 转换到 mp_config
export function generateKbonePageConfig(
  mpConfig: Record<string, any>,
  mainAppData: IWebRuntimeAppData,
  subAppDataList: IWebRuntimeAppData[] = []
) {
  mpConfig.pages = mpConfig.pages || {};
  const allAppDataList = subAppDataList.concat(mainAppData);
  allAppDataList.map((appData) => {
    appData.pageInstanceList.forEach((item) => {
      const pageId = [appData.rootPath, item.id].filter((i) => i).join('_');
      if (!mpConfig.pages[pageId]) {
        mpConfig.pages[pageId] = {};
      }
      const navigationBarTitleText =
        item.data.navigationBarTitleText || item.data.title;

      // 去除部分 mp 不认的属性
      delete item.data.title;
      delete item.data.params;
      delete item.data.scene;

      // page 配置
      KBONE_PAGE_KEYS.forEach((key) => {
        if (item.data[key]) {
          mpConfig.pages[pageId][key] = item.data[key];
          delete item.data[key];
        }
      });
      // extra 配置
      mpConfig.pages[pageId].extra = {
        ...item.data,
        navigationBarTitleText,
      };
    });
  });

  return mpConfig;
}

export function generateKboneAppConfig(
  mpConfig: Record<string, any>,
  mainAppData: IWebRuntimeAppData
) {
  if (mainAppData?.appConfig) {
    if (mainAppData.appConfig.window) {
      mpConfig.app = mpConfig.app || {};
      mpConfig.app = {
        ...mainAppData.appConfig.window,
        ...mpConfig.app,
      };
    }
  }
}

// 生成 kbone mp 配置文件
export async function generateMpJsonConfigFile(
  allAppDataList: IWebRuntimeAppData[],
  userConfig: any,
  appBuildDir: string,
  plugins: IPlugin[],
  options: IGenerateMpJsonConfigFileOpts
) {
  const mainAppData = getMainAppDataByList(
    allAppDataList
  ) as IWebRuntimeAppData;
  const subAppDataList = allAppDataList.filter((i) => i.rootPath);
  const homeId = getHomePageInstance(mainAppData.pageInstanceList).id;
  userConfig = userConfig || {};
  const kbConfig = {
    origin: 'https://weapps.tencent.com',
    entry: `/${homeId}`,
    redirect: {
      notFound: `${homeId}`,
      accessDenied: `${homeId}`,
    },
    generate: {
      autoBuildNpm: true,
      appEntry: 'miniprogram-app',
      appWxss: 'display',
      subpackages: {},
      globalVars: [['__injectProxy', '(window.Proxy = Proxy)']],
    },
    app: {
      navigationBarTitleText: `WeApps-${options.appKey}`,
    },
    projectConfig: {
      appid: 'touristappid',
      projectname: `WeApps-${options.appKey}`,
    },
    packageConfig: {
      author: 'weapps',
    },
    ...userConfig,
    global: {
      ...userConfig.global,
      rem: true, // rem 必须为 true
    },
    router: getMpAllRouterConfig(allAppDataList),
    __homePath__: getMpAllRouterConfig(allAppDataList, true),
  };

  if (subAppDataList?.length) {
    const subpackages = {};
    subAppDataList.map((appData) => {
      const { rootPath } = appData;
      subpackages[rootPath as string] = Object.keys(
        getMpAllRouterConfig([appData])
      );
    });
    kbConfig.generate = {
      ...kbConfig.generate,
      subpackages,
    };
  }

  // kbone 生成子包模式
  if (options.generateMpType === 'subpackage') {
    kbConfig.generate = {
      ...kbConfig.generate,
      app: 'noemit',
    };
  }

  // 补充插件的子包入口
  if (plugins.length > 0) {
    kbConfig.generate.subpackages = {
      ...kbConfig.generate.subpackages,
      ...(await getPluginKboneSubpackage(appBuildDir, plugins)),
    };
  }

  const templateStr = JSON.stringify(kbConfig, null, 2);

  await fs.writeFile(
    path.resolve(appBuildDir, 'webpack/miniprogram.config.js'),
    `module.exports = ${templateStr}`
  );
}

export function getMainAppDataByList(allAppDataList: IWebRuntimeAppData[]) {
  return allAppDataList.find((item) => !item.rootPath);
}

// 获取设置的 home 页面
export function getHomePageInstance(pageInstanceList: any) {
  let target = pageInstanceList[0];
  loopDealWithFn(pageInstanceList, (pageInstance: any) => {
    if (pageInstance.isHome) {
      target = pageInstance;
      return pageInstance;
    }
  });
  return target;
}

// 获取页面名字
export function getPageName(name: string) {
  return `${name}`;
}

export function getMpAllRouterConfig(
  allAppDataList: IWebRuntimeAppData[],
  getHome = false
) {
  const router = {} as any;
  let homePath = '';
  allAppDataList.map((appData) => {
    const { pageInstanceList, rootPath = '' } = appData;
    loopDealWithFn(pageInstanceList, (pageInstance: IPageInstance) => {
      const name = [rootPath, pageInstance.id].filter((i) => i).join('_');
      const path = `/${name}`;
      if (!homePath) {
        homePath = name;
      }
      if (pageInstance.isHome && !rootPath) {
        homePath = name;
      }
      router[name] = [path];
    });
  });
  if (getHome) {
    return homePath;
  }
  return router;
}

export function getWebpackWebBuildParams(
  appBuildDir: string,
  materialsDir: string,
  dependencies: IMaterialItem[] = [],
  nodeModulesPath: string,
  publicPath: string = '/',
  mode = WebpackModeType.NONE,
  watch = false,
  buildTypeList = [BuildType.WEB],
  extraDefine = {},
  assets: string[] = []
) {
  let jsApis: string[] = [];
  fs.ensureDir(path.resolve(appBuildDir, 'assets'));
  if (buildTypeList.includes(BuildType.WECHAT_WORK_H5)) {
    jsApis = ['//res.wx.qq.com/open/js/jweixin-1.2.0.js'];
  } else if (buildTypeList.includes(BuildType.WECHAT_H5)) {
    jsApis = ['//res.wx.qq.com/open/js/jweixin-1.6.0.js'];
  }
  if (assets && assets.length > 0) {
    if (buildTypeList.includes(BuildType.APP)) {
      const targetDir = path.resolve(appBuildDir, './assets');
      assets
        .filter((assetUrl) => !!assetUrl)
        .forEach(async (assetUrl) => {
          const fileName = getFileNameByUrl(assetUrl);
          jsApis.push(`./${fileName}`);
          await downloadAssets(targetDir, assetUrl);
        });
    } else {
      jsApis = jsApis.concat(assets);
    }
  }
  return {
    context: appBuildDir,
    mode: mode !== 'production' ? 'development' : mode,
    watch,
    entry: path.resolve(appBuildDir, 'src/index.jsx'),
    output: {
      // ...(buildAsAdminPortalByBuildType(buildTypeList)
      //   ? {
      //       library: 'lowcode',
      //       libraryTarget: 'umd',
      //       jsonpFunction: 'webpackJsonp_lowcode',
      //     }
      //   : {}),
      path: path.resolve(appBuildDir, './preview'),
      filename:
        mode !== 'production'
          ? '[name].bundle.js'
          : '[name].[contenthash].bundle.js',
      chunkFilename:
        mode !== 'production'
          ? '[name].chunk.js'
          : '[name].[contenthash].chunk.js',
      publicPath:
        buildTypeList.includes(BuildType.APP) ||
        buildTypeList.includes(BuildType.ADMIN_PORTAL)
          ? ''
          : publicPath,
      pathinfo: false,
    },
    htmlTemplatePath: path.resolve(appBuildDir, './html/index.html.ejs'),
    htmlTemplateData: {
      meta: {
        jsApis,
      },
      delevopment: mode !== 'production',
      cloudSDKFileName: CLOUD_SDK_FILE_NAME,
      isAdminPortal: buildTypeList.includes(BuildType.ADMIN_PORTAL),
    },
    externals: {
      mobx: 'window.mobx',
      '@cloudbase/js-sdk': 'window.cloudbase',
      '@cloudbase/weda-cloud-sdk/dist/h5': 'window.CloudSDK',
    },
    resolveModules: [
      path.resolve(appBuildDir, 'node_modules'),
      path.resolve(appBuildDir, 'src'),
      ...getMaterialNodeModulesPathList(dependencies, materialsDir),
    ],
    definePlugin: {
      'process.env.buildType': `"${buildTypeList[0]}"`,
      'process.env.isApp': buildTypeList.includes(BuildType.APP), // 注入环境变量，注入isApp
      'process.env.isAdminPortal': buildAsAdminPortalByBuildType(buildTypeList), // 注入环境变量，判断 ADMIN_PORTAL 应用
      ...extraDefine,
    },
  } as any;
}

export function getWebpackMpBuildParams(
  appBuildDir: string,
  materialsDir: string,
  dependencies: IMaterialItem[] = [],
  nodeModulesPath: string,
  allAppDataList: IWebRuntimeAppData[],
  mode: string,
  watch: boolean,
  options: IGenerateMpJsonConfigFileOpts
) {
  return {
    context: appBuildDir,
    mode,
    watch,
    entry: getAllPageMpEntryPath(allAppDataList, appBuildDir, options),
    outputPath: path.resolve(appBuildDir, 'dist/mp/common'),
    resolveModules: [
      appBuildDir,
      path.resolve(appBuildDir, 'node_modules'),
      path.resolve(appBuildDir, 'src'),
      ...getMaterialNodeModulesPathList(dependencies, materialsDir),
    ],
    watchOptions: {
      ignored: /node_modules/,
      aggregateTimeout: 600,
      poll: 1000,
    },
    cache: {
      type: 'memory',
    },
  } as any;
}

export function getAllPageMpEntryPath(
  allAppDataList: IWebRuntimeAppData[],
  appBuildDir: string,
  options: IGenerateMpJsonConfigFileOpts = { generateMpType: 'app' }
) {
  const entry: Record<string, any> = {};

  // 如果提供的是 subpackage 子包模式，则不包含 miniprogram-app
  if (options.generateMpType === 'app') {
    entry['miniprogram-app'] = path.resolve(
      appBuildDir,
      './src/miniprogram-app.js'
    );
  }

  // 优先填首页
  const mainAppData = getMainAppDataByList(
    allAppDataList
  ) as IWebRuntimeAppData;
  const homePageInstance = getHomePageInstance(mainAppData.pageInstanceList);
  entry[homePageInstance.id] = path.resolve(
    appBuildDir,
    `src/pages/${getPageName(homePageInstance.id)}/main.mp.jsx`
  );

  allAppDataList.map((app) => {
    const { pageInstanceList, rootPath } = app;
    const packagePathStr = rootPath ? `packages/${rootPath}` : '';
    loopDealWithFn(pageInstanceList, (pageInstance: IPageInstance) => {
      const pageName = rootPath
        ? `${rootPath}_${pageInstance.id}`
        : pageInstance.id;
      entry[pageName] = path.resolve(
        appBuildDir,
        path.join(
          'src',
          packagePathStr,
          `pages/${getPageName(pageInstance.id)}/main.mp.jsx`
        )
      );
    });
  });

  return entry;
}

const dependenciesMap = new Map();

export async function downloadAndInstallDependencies(
  dependencies: IMaterialItem[] = [],
  materialsDir: string,
  installOptions: IInstallOpts = {}
) {
  const localPkg = getCurrentPackageJson();
  await Promise.all(
    dependencies.map(async ({ name, version, srcZipUrl }) => {
      const materialNameVersion = `${name}@${version}`;
      const targetDir = path.join(materialsDir, materialNameVersion);
      // 当前本地目录是素材库的时候，直接用本地的
      if (localPkg && localPkg.name === name && localPkg.version === version) {
        console.log(
          '当前本地目录是素材库的时候，无需安装',
          materialNameVersion
        );
        return;
      }
      if (dependenciesMap.get(targetDir)) {
        notice(
          `${materialNameVersion} 存在 ${targetDir}，无需安装, 如果依赖库报错，请重启wa watch`
        );
        return;
      }
      await downloadDependencies(targetDir, srcZipUrl);
      await installDependencies(targetDir, {
        ...installOptions,
        ignoreInstall:
          name === 'gsd-h5-react' && version == '0.0.61'
            ? !!installOptions.ignoreInstall
            : false,
      });
      dependenciesMap.set(targetDir, true);
    })
  );
}

export async function downloadDependencies(
  targetDir: string,
  srcZipUrl: string
) {
  const isExist = fs.existsSync(path.join(targetDir, 'package.json'));
  if (isExist) {
    return;
  }

  try {
    let response = await axios({
      url: srcZipUrl,
      responseType: 'stream',
      // proxy: false
    });

    await fs.ensureDir(targetDir);
    await compressing.zip.uncompress(response.data, targetDir);
  } catch (e) {
    console.error('Fail to download weapps material package ' + srcZipUrl, e);
    throw e;
  }
}

/**
 *
 * @param targetDir 目标目录
 * @param packageName 包名，如果不传则默认安装全部包
 */
export interface IInstallOpts {
  packageName?: string;
  latest?: boolean;
  runtime?: RUNTIME;
  ignoreInstall?: boolean;
}
// TODO use yarn if installed
export async function installDependencies(
  targetDir: string,
  options: IInstallOpts = {}
) {
  if (options?.ignoreInstall) {
    console.log('ignore install dependencies in ' + targetDir);
    return;
  }
  // const isExist = fs.existsSync(path.join(targetDir, 'package-lock.json'))

  // 是否安装最新的
  let packageName = options.packageName || '';
  if (packageName && options.latest) {
    packageName = `${packageName}@latest`;
  }

  console.log('Installing dependencies in ' + targetDir);
  const operationTag = '---------------- Install npm dependencies';
  console.time(operationTag);

  const registry = `--registry=${npmRegistry}`;
  const npmOptions = [
    '--prefer-offline',
    '--no-audit',
    '--progress=false',
    registry,
  ];
  fs.writeFileSync(
    path.join(targetDir, '.npmrc'),
    '@govcloud:registry=https://r.gnpm.govcloud.qq.com',
    'utf8'
  );

  let installProcess;
  // 云端构建, 选用 npm
  if (yarnExists && options?.runtime !== RUNTIME.CI) {
    const addPackage = packageName ? ['add', packageName] : [];
    installProcess = spawn('yarn', [...addPackage, registry], {
      cwd: targetDir,
      env: process.env,
      stdio: ['inherit', 'pipe', 'pipe'],
    });
  } else {
    installProcess = spawn('npm', ['install', packageName, ...npmOptions], {
      cwd: targetDir,
      env: process.env,
      stdio: ['inherit', 'pipe', 'pipe'],
    });
  }

  installProcess.on('exit', () => console.timeEnd(operationTag));

  await promisifyProcess(installProcess);
}

export function getMaterialNodeModulesPathList(
  dependencies: IMaterialItem[] = [],
  materialsDir: string
) {
  const localPkg = getCurrentPackageJson();
  return dependencies.map(({ name, version }) => {
    const nameVersion = `${name}@${version}`;
    if (localPkg && localPkg.name === name && localPkg.version === version) {
      console.log(
        '当前本地目录是素材库的时候，直接使用当前目录的 node_modules',
        nameVersion
      );
      return path.join(process.cwd(), 'node_modules');
    }
    return path.join(materialsDir, nameVersion, 'node_modules');
  });
}

// 生成devServer 核心依赖
export async function generateWebpackWebDevServerFile({
  appBuildDir,
  buildTypeList,
}) {
  const dest = path.resolve(appBuildDir, `./webpack/devServer.js`);
  const template = await fs.readFile(
    path.resolve(appTemplateDir, './webpack/devServer.js'),
    {
      encoding: 'utf8',
    }
  );
  const jsContent = tpl(template, {
    interpolate: /<%=([\s\S]+?)%>/g,
  })({
    isApp: buildTypeList.includes(BuildType.APP),
    isAdminPortal: buildAsAdminPortalByBuildType(buildTypeList),
  });
  await fs.ensureFile(dest);
  await fs.writeFile(dest, jsContent);
}

// 下载js 文件
export async function downloadAssets(targetDir: string, assetUrl: string) {
  const isExist = fs.existsSync(path.join(targetDir, 'package.json'));
  if (isExist) {
    return;
  }

  const [err, response] = await promiseWrapper(
    axios({
      url: assetUrl,
      responseType: 'stream',
      // proxy: false
    })
  );
  if (err) {
    console.error('Fail to download weapps material package ' + assetUrl, err);
    throw err;
  }

  await fs.ensureDir(targetDir);
  const filename = getFileNameByUrl(assetUrl);
  const targetPath = path.resolve(targetDir, `./${filename}`);
  const writer = fs.createWriteStream(targetPath);
  (response as any).data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', () => {
      console.log('下载成功', assetUrl);
      fs.copy(targetDir, path.resolve(targetDir, '../preview'));
      resolve(targetPath);
    });
    writer.on('error', () => {
      console.error('下载失败', assetUrl);
      reject();
    });
  });
}
