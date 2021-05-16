import {
  extractAndRemoveKbConfig,
  installDependencies,
  IInstallOpts,
} from '../service/builder/webpack';
import { getCompileDirs } from '../service/builder';
import {
  IMaterialItem,
  deserialize,
  IWeAppData,
  IPlugin,
} from '../../weapps-core';
import {
  BuildType,
  GenerateMpType,
  WebpackBuildCallBack,
  WebpackModeType,
} from '../types/common';
export { buildAsWebByBuildType } from '../types/common';
import { runGenerateCore } from './generate';
import { runHandleMaterial } from './material';
import { runCopy } from './copy';
import { createDoneCallBack, runPrepare } from './prepare';
import { runWebpackCore } from './webpack';
import { generateWxMp } from '../mp/index';
import path from 'path';
import { DEPLOY_MODE, RUNTIME } from '../../types';
import { handleMixMode } from '../mp/mixMode';
import chalk from 'chalk';

export type BuildAppProps = {
  dependencies: IMaterialItem[];
  mainAppSerializeData?: IWeAppData;
  subAppSerializeDataList?: IWeAppData[];
  appKey: string;
  nodeModulesPath: string;
  publicPath?: string;
  buildTypeList: BuildType[];
  mode?: WebpackModeType;
  watch?: boolean;
  generateMpType: GenerateMpType;
  generateMpPath?: string;
  isCleanDistDir?: boolean;
  plugins?: IPlugin[];
  extraData?: {
    isComposite: boolean;
    compProps: any;
  };
};

export async function buildWebApp(
  {
    mainAppSerializeData,
    subAppSerializeDataList = [],
    dependencies,
    appKey = 'test',
    nodeModulesPath,
    runtime = RUNTIME.NONE,
    ignoreInstall = false,
    buildTypeList = [BuildType.WEB],
    mode = WebpackModeType.PRODUCTION,
    deployMode = DEPLOY_MODE.PREVIEW,
    watch = false,
    generateMpType = GenerateMpType.APP,
    generateMpPath = '',
    isCleanDistDir = false,
    plugins = [],
    extraData = {
      isComposite: false,
      compProps: {},
    },
    isCrossAccount = false,
    resourceAppid = undefined,
  }: BuildAppProps & {
    deployMode: DEPLOY_MODE;
    runtime: RUNTIME;
    ignoreInstall: boolean;
    isCrossAccount: boolean;
    resourceAppid?: string;
  },
  cb?: WebpackBuildCallBack
) {
  if (!mainAppSerializeData) {
    console.error('无效的应用配置');
    return;
  }
  console.log('应用名', appKey);
  console.log('生成模式', generateMpType);
  if (generateMpType === GenerateMpType.SUBPACKAGE) {
    console.log('主包项目路径', generateMpPath);
  }

  let { appBuildDir, materialsDir } =
    runtime === RUNTIME.CI ? getCompileDirs('app') : getCompileDirs(appKey);

  const startTime = Date.now();
  if (buildTypeList.includes(BuildType.MP)) {
    appBuildDir = path.join(appBuildDir, 'mp');

    const isMixMode = generateMpType === GenerateMpType.SUBPACKAGE;

    const apps = [mainAppSerializeData, ...subAppSerializeDataList];
    try {
      const result = await generateWxMp(
        apps,
        appBuildDir,
        appKey,
        dependencies,
        plugins,
        mode === WebpackModeType.PRODUCTION,
        deployMode,
        extraData,
        isMixMode,
        { isCrossAccount: !!isCrossAccount, resourceAppid }
      );
      // 如果是混合模式，则将特定的目录复制到工程下
      // 针对 app.json / package.json 则采用 merge 的操作
      if (isMixMode) {
        generateMpPath = appBuildDir;
        console.log(chalk.green('【混合模式】'), generateMpPath);
        await handleMixMode({
          apps,
          generateMpPath,
          miniprogramRoot: result.miniprogramRoot,
          plugins,
        });
      }

      cb?.(null, {
        ...result,
        outDir: isMixMode && generateMpPath ? generateMpPath : appBuildDir,
        timeElapsed: Date.now() - startTime,
      });
      return appBuildDir;
    } catch (e) {
      console.log('generateWxMp error', e);
      cb && cb(e);
      return;
    }
  } else {
    appBuildDir = path.join(appBuildDir, 'h5');

    // 处理应用数据
    const mainAppData = deserialize(mainAppSerializeData);
    const subAppDataList = subAppSerializeDataList.map((sub) =>
      deserialize(sub)
    );

    // 前置操作
    const { publicPath, basename, assets = '' } =
      mainAppData.appConfig?.window || {};
    const projectConfig = await runPrepare(
      buildTypeList,
      appBuildDir,
      isCleanDistDir
    );

    // 处理 mp_config
    const mpConfig = await extractAndRemoveKbConfig(
      mainAppData,
      subAppDataList,
      appBuildDir
    );

    // 获取 插入的cdn 资源
    const jsAssets = assets.split(',').map((item) => (item || '')?.trim());

    // 复制
    await runCopy(appBuildDir, mainAppData);
    // 素材库
    const runHandleMaterialTag = '======= buildWebApp-runHandleMaterial';
    console.time(runHandleMaterialTag);
    await runHandleMaterial(
      appBuildDir,
      dependencies,
      materialsDir,
      runtime,
      ignoreInstall
    );
    console.timeEnd(runHandleMaterialTag);

    // 安装依赖
    await runGenerateCore(
      appBuildDir,
      mainAppData,
      subAppDataList,
      dependencies,
      appKey,
      basename,
      buildTypeList,
      deployMode,
      runtime,
      ignoreInstall,
      extraData
    );

    const doneCallback = createDoneCallBack({ appBuildDir, projectConfig }, cb);
    await runWebpackCore({
      appBuildDir,
      mainAppData,
      subAppDataList,
      materialsDir,
      dependencies,
      nodeModulesPath,
      publicPath,
      mode,
      watch,
      appKey,
      cb: doneCallback,
      mpConfig,
      buildTypeList,
      generateMpType,
      generateMpPath,
      plugins,
      assets: jsAssets,
    });

    return appBuildDir;
  }
}

export function installDep(dir, opts: IInstallOpts = {}) {
  return installDependencies(dir, opts);
}

export default buildWebApp;
