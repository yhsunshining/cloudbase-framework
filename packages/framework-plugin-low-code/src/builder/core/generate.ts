import { IMaterialItem, IWebRuntimeAppData } from '../../weapps-core';
import { BuildType } from '../types/common';
import {
  generateAllPageJsxFile,
  generateAppStyleLessFile,
  generateRouterFile,
  generateThemeVarsFile,
  generateCodeFromTpl,
  writeLowCodeFiles,
} from '../service/builder/generate';
import path from 'path';
import { installDependencies } from '../service/builder/webpack';
import fs from 'fs-extra';
import { notice, log } from '../util/console';
import { appTemplateDir } from '../config';
import chalk from 'chalk';
import { DEPLOY_MODE, RUNTIME } from '../../types';
import tpl from 'lodash.template';

let lastDeps: Object | null = null;

function isInLastDeps(deps) {
  for (const i in deps) {
    if (!lastDeps || !lastDeps?.[i] || lastDeps?.[i] !== deps[i]) {
      log(
        `package.json ${i}:${deps[i]} 和 上一次依赖${lastDeps?.[i]} 不一致, 重新安装依赖...`
      );
      return false;
    }
  }
  return true;
}

export async function runGenerateCore(
  appBuildDir: string,
  appData: IWebRuntimeAppData,
  subAppDataList: IWebRuntimeAppData[] = [],
  dependencies: IMaterialItem[] = [],
  appKey: string,
  basename: string, // browser Router 里指定的basename
  buildTypeList: BuildType[],
  deployMode: DEPLOY_MODE,
  runtime: RUNTIME = RUNTIME.NONE,
  ignoreInstall: boolean = false,
  extraData: {
    isComposite: boolean;
    compProps: any;
  } = {
    isComposite: false,
    compProps: {},
  },
  domain: string
) {
  const timeTag = '-------------------- runGenerateCore';
  console.time(timeTag);
  const allAppDataList = subAppDataList.concat(appData);
  // 安装插件依赖
  const deps = {};
  allAppDataList.map((app) => {
    Object.entries(app.npmDependencies).forEach(([name, version]) => {
      deps[name] = version;
    });
  });

  // 合并组件库的公共npm
  dependencies.map((compLb) => {
    if (compLb.isComposite && compLb.compLibCommonResource) {
      Object.assign(deps, compLb.compLibCommonResource.npm);
    }
  });

  await Promise.all(
    allAppDataList.map(async (data) => {
      const { pageInstanceList, rootPath = '' } = data;
      const appName = rootPath ? 'Sub app ' + rootPath : 'Main app';
      console.log(chalk.blue.bold('Generating files for ' + appName));
      const dstDir = path.join(
        appBuildDir,
        'src',
        rootPath ? `${rootPath}` : ''
      );
      await copy(
        ['app/mountMpApis.js', 'app/mountAppApis.js', 'datasources'],
        dstDir
      );

      const tplStr = await fs.readFile(
        path.join(appTemplateDir, 'src/app/global-api.js'),
        {
          encoding: 'utf8',
        }
      );
      const globalApiContent = tpl(tplStr)({
        appId: appKey,
        subPackageName: rootPath,
        domain: domain,
      });
      await fs.writeFile(
        path.join(dstDir, 'app/global-api.js'),
        globalApiContent
      );

      await generateAllPageJsxFile(
        pageInstanceList,
        dstDir,
        rootPath,
        dependencies,
        extraData,
        buildTypeList
      );
      await generateCodeFromTpl(
        data,
        dstDir,
        dependencies,
        appKey,
        rootPath,
        deployMode,
        buildTypeList,
        extraData
      );
      await writeLowCodeFiles(data, dstDir);
    })
  );
  await generateRouterFile(
    allAppDataList,
    appBuildDir,
    basename,
    buildTypeList
  );
  await generateAppStyleLessFile(allAppDataList, appBuildDir);
  await generateThemeVarsFile(appData.themeVars, appBuildDir);
  if (lastDeps && isInLastDeps(deps)) {
    notice(
      'package.json dependencies 已经安装，如出现未安装成功或找不到依赖，请重启wa watch'
    );
  } else {
    await generatePackageJSON(deps, appBuildDir, appKey);
    await installDependencies(appBuildDir, {
      runtime,
      ignoreInstall,
    });
    lastDeps = deps;
  }

  console.timeEnd(timeTag);
}
export async function generatePackageJSON(
  dependencies: object = {},
  appBuildDir: string,
  appKey
) {
  const packageInfo = fs.readJSONSync(
    path.join(appTemplateDir, 'package.json')
  );
  packageInfo.dependencies = { ...packageInfo.dependencies, ...dependencies };
  packageInfo.name = 'WeDa-' + appKey;
  const dstFilePath = path.join(appBuildDir, 'package.json');
  await fs.writeFile(dstFilePath, JSON.stringify(packageInfo, null, '\t'));
}

async function copy(srcFiles: string[], dstDir: string) {
  for (const entry of srcFiles) {
    const dstFile = path.join(dstDir, entry);
    console.log(dstFile);
    await fs.copy(path.join(appTemplateDir, 'src', entry), dstFile);
  }
}
