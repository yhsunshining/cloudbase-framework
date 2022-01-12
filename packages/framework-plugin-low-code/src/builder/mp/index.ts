import chalk from 'chalk';
import path from 'path';
import { inspect } from 'util';
import * as fs from 'fs-extra';
import {
  IMaterialItem,
  IWeAppData,
  loopDealWithFn,
  IPlugin,
  toCssText,
  toCssStyle,
  IWeAppCode,
} from '../../weapps-core';
import { appTemplateDir, materialsDirName } from '../config';
import { getWxmlDataPrefix } from '../config/mp';
import generateFiles, {
  removeFile,
  cleanDir,
  writeFile,
} from '../util/generateFiles';
import { extractUsedCompsRecursively, installMaterials } from './materials';
import { installDependencies } from '../service/builder/webpack';
import { IBuildContext } from './BuildContext';
import {
  createWidgetProps,
  createEventHanlders,
  createDataBinds,
} from './util';
import { generateWxml, getUsedComponents } from './wxml';
import { writeCode2file } from './lowcode';
import { generateMpConfig } from './mp_config';
import { getPluginType } from '../service/builder/plugin';
import { runHandleMpPlugin } from '../core/plugin';
import { getYyptConfigInfo, JsonToStringWithVariableName } from '../util';
import { generateDefaultTheme, generateDefaultStyle } from '../util/style';
import {
  getDatasourceProfiles,
  getDatasetProfiles,
} from '../../utils/dataSource';

import { DEPLOY_MODE } from '../../types';
import {
  buildAsAdminPortalByBuildType,
  BuildType,
  IAppUsedComp,
  IUsedComps,
} from '../types/common';
import { add, get } from 'lodash';
import * as junk from '../util/junk';
import pt from 'path';
import { downloadZip } from '../util/net';

const templateDir = appTemplateDir + '/mp/';
const em = chalk.blue.bold;
const error = chalk.redBright;

export async function generateWxMp({
  weapps,
  projDir,
  appId,
  domain,
  materials,
  plugins,
  isProduction,
  deployMode,
  extraData,
  isMixMode,
  options,
  buildTypeList,
}: {
  weapps: IWeAppData[];
  projDir: string;
  appId: string; // 应用appId
  domain: string;
  materials: IMaterialItem[];
  plugins: IPlugin[];
  isProduction: boolean;
  deployMode: DEPLOY_MODE;
  extraData: any;
  isMixMode: boolean;
  options: {
    resourceAppid?: string;
    isCrossAccount: boolean;
  };
  buildTypeList: BuildType[];
}): Promise<{ miniprogramRoot: string }> {
  const operationLabel = em('Wexin MiniProgram Generated');
  console.time(operationLabel);
  console.log('Generating ' + em('Wexin MiniProgram') + ' to ' + projDir);

  console.log(em('domain') + domain);
  let mainAppData = weapps[0];

  const buildContext: IBuildContext = {
    projDir,
    appId,
    isProduction,
    materialLibs: materials,
    isMixMode,
    mainAppData,
    domain,
  };

  const yyptConfig = await getYyptConfigInfo(extraData);
  const { appUsedComps, allAppUsedComps } = handleUsedComponents({
    buildContext,
    weapps,
    materials,
  });

  buildContext['miniprogramPlugins'] = (
    mainAppData.miniprogramPlugins || []
  ).filter((plugin) => allAppUsedComps[plugin.name]);

  // 安装依赖库，生成 materials 目录
  await installMaterials(projDir, allAppUsedComps, weapps, buildContext);

  const wxmlDataPrefix = getWxmlDataPrefix(!isProduction);

  const { projConfig, appConfig, pageConfigs } = generateMpConfig(
    weapps,
    buildContext
  );

  // #1 generate project files
  if (!mainAppData.mpPkgUrl) {
    const projectFileData = {
      'project.config.json': { content: projConfig },
    };
    console.log('Generating ' + em('project') + ' files');
    await generateFiles(projectFileData, templateDir, projDir, buildContext);
  }

  // #2 生成主包
  await generatePkg(
    mainAppData,
    path.join(projDir, '/'),
    { ...buildContext, rootPath: mainAppData.rootPath },
    pageConfigs[0]
  );

  const projectConfigJsonPath = path.join(
    projDir,
    mainAppData.rootPath || '',
    'project.config.json'
  );
  let projectConfigJson = await fs.readJSON(projectConfigJsonPath);

  const miniprogramRoot = path.join(
    projDir,
    projectConfigJson.miniprogramRoot || '/'
  );

  // #3 生成主包根路径文件
  let appFileData: Record<string, object> = {};
  if (weapps.find((item) => !item.mpPkgUrl)) {
    // 非全部都是 zip 包的情况，生成系统文件
    await generateFramework(mainAppData, miniprogramRoot, buildContext);
    appFileData = {
      ...appFileData,
      'common/style.js': {},
      'common/utils.wxs': {
        domain: domain,
      },
      'common/util.js': {
        isAdminPortal: buildAsAdminPortalByBuildType(buildTypeList as any),
      },
      'common/widget.js': {},
      'common/url.js': {},
      'common/weapp-sdk.js': {},
      'common/weapp-page.js': {
        dataPropNames: wxmlDataPrefix,
        debug: !buildContext.isProduction,
      },
      'common/weapp-component.js': {},
      'common/merge-renderer.js': {
        dataPropNames: wxmlDataPrefix,
        debug: !buildContext.isProduction,
      },
      'common/process.js': {},
      'common/data-patch.js': {},
    };
  }

  if (mainAppData.mpPkgUrl) {
    // 合并 project 和 app json
    if (!projectConfigJson.setting) {
      projectConfigJson.setting = {};
    }

    projectConfigJson.setting = {
      ...projectConfigJson.setting,
      ...projConfig.setting,
    };
    await writeFile(
      projectConfigJsonPath,
      JSON.stringify(projectConfigJson, undefined, 2)
    );

    let appJsonPath = path.join(miniprogramRoot, 'app.json');
    let appJson = await fs.readJson(appJsonPath);
    let subpackages = appJson.subpackages || [];
    for (let item of (appConfig as any).subpackages || []) {
      let find = subpackages.find((config) => config.root === item.root);
      if (find) {
        find.pages = Array.from(
          new Set([].concat(find.pages || []).concat(item.pages || []))
        );
      } else {
        subpackages.push(item);
      }
    }
    appJson.subpackages = subpackages;
    await writeFile(appJsonPath, JSON.stringify(appJson, undefined, 2));

    let appJsPath = path.join(miniprogramRoot, 'app.js');
    let appJsContent = await fs.readFile(appJsPath);
    await writeFile(
      appJsPath,
      `import { app as wedaApp } from './app/weapps-api'\n${appJsContent}`
    );
  } else {
    appFileData = {
      ...appFileData,
      'common/wx_yypt_report_v2.js': {},
      'app.js': { yyptConfig: yyptConfig },
      'app.json': { content: appConfig },
      'app.wxss': {
        importStyles: materials.reduce((styles, lib) => {
          styles = styles.concat(
            (lib.styles || []).map((stylePath) =>
              stylePath && !stylePath.startsWith('/')
                ? `/${materialsDirName}/${lib.name}/${stylePath}`
                : stylePath
            ) || []
          );
          return styles;
        }, [] as string[]),
      },
      'package.json': {
        appId,
        extraDeps: resolveNpmDeps(),
      },
    };
  }
  console.log('Generating ' + em('miniprogramRoot') + ' files');
  await generateFiles(appFileData, templateDir, miniprogramRoot, buildContext);

  // 若项目目录与小程序根目录不同，则拷贝素材到小程序根目录
  if (
    miniprogramRoot !== path.join(projDir, '/') &&
    fs.existsSync(path.join(projDir, materialsDirName))
  ) {
    console.log(
      'Move ' +
        em(materialsDirName) +
        ' from' +
        `${projDir} to ${miniprogramRoot}`
    );
    await fs.move(
      path.join(projDir, materialsDirName),
      path.join(miniprogramRoot, materialsDirName)
    );
  }

  // 有低码包的情况,生成数据源
  if (weapps.find((item) => !item.mpPkgUrl)) {
    const datasourceFileData = {
      'datasources/index.js': {},
      'datasources/config.js.tpl': {
        envID: mainAppData.envId,
        appID: appId,
        resourceAppid: !!options.isCrossAccount ? options.resourceAppid : '',
        isProd: deployMode === DEPLOY_MODE.UPLOAD,
      },
      'datasources/datasource-profiles.js.tpl': {
        datasourceProfiles: JsonToStringWithVariableName(
          getDatasourceProfiles(
            weapps.reduce((datasources, app) => {
              datasources.push(...(app.datasources || []));
              return datasources;
            }, [] as any[])
          )
        ),
      },
      'datasources/dataset-profiles.js.tpl': {
        datasetProfiles: JsonToStringWithVariableName(
          getDatasetProfiles(mainAppData as any, weapps)
        ),
      },
    };

    console.log('Generating ' + em('datasources') + ' files');
    await generateFiles(
      datasourceFileData,
      templateDir,
      miniprogramRoot,
      buildContext
    );
  }

  // 生成子包
  await Promise.all(
    weapps.map(async (app, index) => {
      if (index == 0) {
        return;
      } else {
        const subpackageRootPath = path.join(
          miniprogramRoot,
          app.rootPath || '/'
        );
        let subpackageBuildCtx = {
          ...buildContext,
          rootPath: app.rootPath,
        };
        await generatePkg(
          app,
          subpackageRootPath,
          subpackageBuildCtx,
          pageConfigs[index]
        );
        await generateFramework(app, subpackageRootPath, subpackageBuildCtx);

        // 生成package.json
        let packageJsonPath = path.join(subpackageRootPath, 'package.json');
        if (!fs.existsSync(packageJsonPath)) {
          await generateFiles(
            {
              'package.json': {
                appId,
                extraDeps: resolveNpmDeps(),
              },
            },
            templateDir,
            subpackageRootPath,
            buildContext
          );
        }
      }
    })
  );

  if (fs.existsSync(path.join(miniprogramRoot, 'package.json'))) {
    await installDependencies(miniprogramRoot);
  }

  await handleMpPlugins();

  console.timeEnd(operationLabel);

  cleanProj(weapps, miniprogramRoot);
  cleanMaterils(path.join(miniprogramRoot, materialsDirName), allAppUsedComps);
  return { miniprogramRoot };

  function resolveNpmDeps() {
    const deps = weapps.map((app) => app.npmDependencies);
    materials.map((lib) => deps.push((lib as any).dependencies));

    // 合并组件库的公共npm
    materials.map((compLb) => {
      if (compLb.isComposite && compLb.compLibCommonResource) {
        deps.push(compLb.compLibCommonResource.npm || {});
      }
    });
    return deps.reduce((combined, cur) => {
      return { ...combined, ...cur };
    }, {});
  }

  // SDK 插件
  async function handleMpPlugins() {
    // 编译后置原生小程序类的安装
    const mpPlugins = (await getPluginType(miniprogramRoot, plugins)).filter(
      (item) => item.type === 'mp'
    );
    await runHandleMpPlugin(miniprogramRoot, mpPlugins);
  }
}

async function generatePkg(
  weapp: IWeAppData,
  appRoot: string,
  ctx: IBuildContext,
  pageConfigs
) {
  const wxmlDataPrefix = getWxmlDataPrefix(!ctx.isProduction);
  console.log(
    'Generating ' + em(weapp.rootPath ? 'subApp' : 'app') + ' to ' + appRoot
  );
  if (weapp.mpPkgUrl) {
    // 清空历史文件，使用zip覆盖
    console.log(`Removing ${appRoot}`);
    await cleanDir(appRoot, ['materials']);
    await downloadZip(weapp.mpPkgUrl, appRoot);
    if (fs.existsSync(path.join(appRoot, '__MACOSX'))) {
      await fs.remove(path.join(appRoot, '__MACOSX'));
    }
  } else {
    // #2 generate page files
    console.log('Generating ' + em('page') + ' files');
    cleanDir(path.join(appRoot, 'pages'), []);
    await Promise.all(
      weapp.pageInstanceList.map(async (page) => {
        // # Generating page
        const rootPath = weapp.rootPath || '';
        const usingComponents = {};
        const wxml = generateWxml(
          page.componentInstances,
          `Page ${rootPath ? path.join(rootPath, 'pages') : ''}/${page.id}`,
          wxmlDataPrefix,
          { ...ctx, rootPath, isPage: true },
          usingComponents
        );

        const pageFileName = get(
          pageConfigs,
          `${page.id}.pageFileName`,
          'index'
        );
        const pageFileData = {
          [`index.js|${pageFileName}.js`]: {
            widgetProps: createWidgetProps(page.componentInstances, ctx),
            pageUUID: rootPath ? `${rootPath}/${page.id}` : page.id,
            pageName: page.id,
            eventHanlders: createEventHanlders(
              page.componentInstances,
              '$page',
              ctx
            ),
            dataBinds: createDataBinds(page.componentInstances, ctx),
            debug: !ctx.isProduction,
            stringifyObj: inspect,
            subLevelPath: rootPath ? pt.relative(rootPath, '') + '/' : '',
          },
          [`index.json|${pageFileName}.json`]: {
            usingComponents,
            extra: getAppendableJson(pageConfigs[page.id]),
          },
          [`index.wxml|${pageFileName}.wxml`]: {
            // raw: JSON.stringify(page.componentInstances),
            content: wxml,
          },
          [`index.wxss|${pageFileName}.wxss`]: {
            subWxss:
              rootPath && !ctx.mainAppData?.mpPkgUrl
                ? `@import "${pt.relative(
                    `/${rootPath}/pages/${page.id}`,
                    '/lowcode'
                  )}/style.wxss";`
                : '',
            content: toCssText(
              toCssStyle(page.commonStyle, {
                toRem: false,
                toRpx: true,
              }),
              'page'
            ),
            pageWxss: `@import "../../lowcode/${page.id}/style.wxss"`,
          },
          'api.js': {},
        };
        // Generating file by template and data
        await generateFiles(
          pageFileData,
          templateDir + '/page',
          path.join(appRoot, 'pages', page.id),
          ctx
        );
      })
    );

    // #3 writing lowcode files
    await writeLowCodeFiles(weapp, appRoot, ctx);
  }
}

async function generateFramework(
  appData: IWeAppData,
  outDir: string,
  ctx: IBuildContext
) {
  let fileData: Record<string, any> = {};
  if (appData.mpPkgUrl) {
    if (!appData.rootPath) {
      fileData = {
        ...fileData,
        'app/app-global.js': {},
        'app/weapps-api.js': {
          appId: ctx.appId,
          subLevelPath: '',
          subPackageName: '',
          isBare: true,
          domain: ctx.domain || '',
        },
      };
    }
  } else {
    const allCodeModules: { id: string; lowCodes: IWeAppCode[] }[] = [];
    loopDealWithFn(appData.pageInstanceList || [], (p) => {
      allCodeModules.push({
        id: p.id,
        lowCodes: p.lowCodes || [],
      });
    });

    fileData['app/handlers.js'] = {
      pageModules: allCodeModules.sort(),
    };
    // 子包混合模式 只在子包中生成 handlers
    const isMixSubpackage = ctx.isMixMode && appData.rootPath;
    if (!isMixSubpackage) {
      fileData = {
        ...fileData,
        'app/app-global.js': {},
        'app/weapps-api.js': {
          appId: ctx.appId,
          domain: ctx.domain || '',
          subLevelPath: appData.rootPath
            ? path.relative(`${appData.rootPath}`, '') + '/'
            : '',
          subPackageName: appData.rootPath || '',
          isBare: false,
        },
        'app/common.js': {
          mods: appData.lowCodes
            .filter(
              (m) => m.type === 'normal-module' && m.name !== '____index____'
            )
            .map((m) => m.name)
            .sort(),
        },
      };
    }
  }

  console.log('Generate app framework');
  await generateFiles(fileData, templateDir, outDir, ctx);
}

export async function writeLowCodeFiles(
  appData: IWeAppData,
  outDir: string,
  ctx: IBuildContext
) {
  console.log('Writing ' + em('lowcode') + ' files:');
  const lowcodeRootDir = path.join(outDir, 'lowcode');
  const themeStyle = generateDefaultTheme(appData);
  // 混合模式，子包不生成顶级（应用级）的 lowcodes
  if (!(ctx.isMixMode && appData.rootPath)) {
    await Promise.all(
      appData.lowCodes
        .filter((mod) => mod.name !== '____index____')
        .map((m) =>
          writeCode2file(m, lowcodeRootDir, { appDir: outDir }, themeStyle.code)
        )
    );
  }

  await Promise.all(
    loopDealWithFn(appData.pageInstanceList, async (page) => {
      generateDefaultStyle(page);
      await page?.lowCodes
        ?.filter((mod) => mod.name !== '____index____')
        .forEach((m) =>
          writeCode2file(
            m,
            lowcodeRootDir,
            { pageId: page.id, appDir: outDir },
            themeStyle.code,
            ctx
          )
        );
    })
  );
}

// {a: 1} -> , "a": 1
function getAppendableJson(obj) {
  if (obj && Object.keys(obj).length > 0) {
    const str = JSON.stringify(obj);
    return ',\n' + str.substr(1, str.length - 2);
  }
  return '';
}

// 处理使用到的组件
export function handleUsedComponents({
  buildContext,
  weapps,
  materials,
}: {
  buildContext: IBuildContext;
  weapps: IWeAppData[];
  materials: IMaterialItem[];
}) {
  const appUsedComps: IAppUsedComp[] = weapps.map((app) => {
    const usedComps: IUsedComps = {};
    app.pageInstanceList?.forEach((p) =>
      getUsedComponents(p.componentInstances, usedComps)
    );
    return {
      rootPath: app.rootPath || '',
      usedComps,
    };
  });
  // merge all app/subapp used
  let allAppUsedComps: IUsedComps = appUsedComps.reduce((comps, item) => {
    Object.keys(item.usedComps).forEach((libName) => {
      comps[libName] = new Set([
        ...Array.from(item.usedComps[libName]),
        ...Array.from(comps[libName] || []),
      ]);
    });
    return comps;
  }, {});
  const compositedLibs = materials.filter((lib) => lib.isComposite);
  allAppUsedComps = extractUsedCompsRecursively(
    allAppUsedComps,
    [],
    compositedLibs
  );
  if (buildContext.isMixMode) {
    appUsedComps.forEach((item) => {
      const appCompositedLibs = materials.filter((lib) => lib.isComposite);
      item.usedComps = extractUsedCompsRecursively(
        item.usedComps,
        [],
        appCompositedLibs
      );
    });
  }

  return {
    appUsedComps,
    allAppUsedComps,
  };
}

async function cleanProj(weapps: IWeAppData[], miniprogramRoot: string) {
  weapps.map((pkg) => cleanPkg(pkg, miniprogramRoot));
}

async function cleanPkg(pkg: IWeAppData, miniprogramRoot: string) {
  // zip 模式跳过clean
  if (pkg.mpPkgUrl) {
    return;
  }
  const pkgDir = [miniprogramRoot, pkg.rootPath]
    .filter((p) => !!p)
    .join(path.sep);
  const pagesDir = path.join(pkgDir, 'pages');
  const lowcodesDir = path.join(pkgDir, 'lowcode');
  const existedPages = await fs.readdir(pagesDir);
  const pages = pkg.pageInstanceList.map((p) => p.id);

  existedPages.forEach((pageName) => {
    const pageDir = path.join(pagesDir, pageName);
    const lowcodeDir = path.join(lowcodesDir, pageName);
    if (pages.indexOf(pageName) < 0) {
      // #1 clean page & lowcode of deleted page
      removeFile(pageDir);
      removeFile(lowcodeDir);
    } else {
      // #2 clean deleted handlers
      const handlersDir = path.join(lowcodeDir, 'handler');
      const handlers =
        pkg?.pageInstanceList
          ?.find((p) => p.id === pageName)
          ?.lowCodes?.filter((m) => m.type === 'handler-fn')
          ?.map((m) => m.name + '.js') || [];
      cleanDir(handlersDir, handlers);
    }
  });
  // #3 clean deleted common modules
  const commonModules = pkg.lowCodes
    .filter((m) => m.type === 'normal-module')
    .map((m) => m.name + '.js');
  const commonDir = path.join(lowcodesDir, 'common');
  cleanDir(commonDir, commonModules);
}

/**
 * Delete unsed materials
 */
function cleanMaterils(materialsDir: string, usedComps: IUsedComps) {
  if (fs.existsSync(materialsDir)) {
    fs.readdirSync(materialsDir)
      .filter(junk.not)
      .map((libName) => {
        const libDir = path.join(materialsDir, libName);

        if (fs.existsSync(path.join(libDir, 'meta.json'))) {
          try {
            removeFile(path.join(libDir, 'meta.json'));
          } catch (e) {}
          // Skip none-composited materials
          return;
        }
        if (!usedComps[libName]) {
          removeFile(libDir);
          return;
        }
        cleanDir(libDir, [...Array.from(usedComps[libName]), 'libCommonRes']);
      });
  }
}
