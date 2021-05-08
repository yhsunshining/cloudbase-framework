import {
  IMaterialItem,
  IWebRuntimeAppData,
  IExtraData,
  IBuildType,
  II18nConfig,
} from '../../weapps-core';
import { runGenerateCore } from './generate';
import { runHandleMaterial } from './material';
import { BuildType, IFileCodeMap } from '../types/common';
import templateCodeMap from '../template';
import path from 'path';
import { DEPLOY_MODE, RUNTIME } from '../../types';

export { serialize, deserialize } from '../../weapps-core';

export type BuildAppProps = {
  dependencies: IMaterialItem[];
  appKey: string;
  mainAppData: IWebRuntimeAppData;
  subAppDataList?: IWebRuntimeAppData[];
  publicPath?: string;
  i18nConfig?: II18nConfig;
  extraData?: IExtraData;
  basename?: string;
  appBuildDir?: string;
  jsAssets?: string[];
  isSandbox?: boolean;
  buildTypeList: IBuildType[];
  ignoreInstall?: boolean;
  deployMode?: DEPLOY_MODE;
  runtime?: RUNTIME;
};

export async function generateCode(props: BuildAppProps) {
  const {
    mainAppData,
    subAppDataList = [],
    dependencies,
    appKey = 'test',
    i18nConfig = {
      enabled: false,
      i18nData: {},
    },
    extraData = {
      isComposite: false,
      compProps: {},
    },
    basename = '/',
    isSandbox = false,
    buildTypeList = [BuildType.WEB],
    ignoreInstall = false,
    deployMode = DEPLOY_MODE.PREVIEW,
    runtime = RUNTIME.NONE,
  } = props;

  // 处理应用数据
  const fileCodeMap: IFileCodeMap = {};
  const appBuildDir = '/';
  const excludeRegex = isSandbox ? /(monitor-jssdk\.min\.js)$/ : null;
  const includeRegex = /^\/src\/(utils|handlers|app|store)/;
  copyFiles({
    appBuildDir,
    excludeRegex,
    includeRegex,
    fileCodeMap,
  });
  // i8n数据
  // fileCodeMap[path.join(appBuildDir, 'src/i18n/index.js')] = {
  //   code: `export default ${JSON.stringify(i18nConfig.i18nData, null, 2)}`,
  // };

  // 素材库
  if (!isSandbox) {
    await runHandleMaterial(
      appBuildDir,
      dependencies,
      i18nConfig,
      fileCodeMap,
      isSandbox
    );
  }

  // 生成核心文件
  await runGenerateCore({
    appBuildDir,
    appData: mainAppData,
    subAppDataList,
    dependencies,
    appKey,
    buildTypeList,
    basename,
    extraData,
    i18nConfig,
    fileCodeMap,
    isSandbox,
    ignoreInstall,
    deployMode,
    runtime,
  });

  return fileCodeMap;
}

export async function generateCompLibs(compLibs) {
  const fileCodeMap = {};
  const dependencies = compLibs;
  const isSandbox = true;
  const i18nConfig = {};
  const appBuildDir = '/';
  await runHandleMaterial(
    appBuildDir,
    dependencies,
    i18nConfig,
    fileCodeMap,
    isSandbox
  );
  const includeRegex = /^\/src\/(utils|handlers)/;
  copyFiles({
    appBuildDir,
    excludeRegex: null,
    includeRegex,
    fileCodeMap,
  });
  return fileCodeMap;
}

function copyFiles({ appBuildDir, excludeRegex, includeRegex, fileCodeMap }) {
  Object.keys(templateCodeMap).map((filePath) => {
    if (includeRegex) {
      const isInclude = includeRegex.test(filePath);
      if (isInclude) {
        const isExclude = excludeRegex?.test(filePath);
        if (isExclude) {
          return;
        }

        const dstFile = path.join(appBuildDir, filePath);
        fileCodeMap[dstFile] = {
          code: templateCodeMap[filePath].code,
        };
      }
    }
  });
}

export default generateCode;
