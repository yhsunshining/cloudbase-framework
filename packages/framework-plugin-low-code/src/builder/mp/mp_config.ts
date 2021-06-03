import * as path from 'path';
import { merge, get } from 'lodash';
import { defaultProjConfig } from '../config/mp';
import { IWeAppData, IWeAppPage, loopDealWithFn } from '../../weapps-core';
import { IBuildContext } from './BuildContext';
import { MP_CONFIG_MODULE_NAME } from '../config';
import { downloadFile } from '../util/net';
import chalk from 'chalk';

/**
 * generate app.json & page.json for mp
 *
 * @param kboneConfig https://wechat-miniprogram.github.io/kbone/docs/config/
 * @param appConfigs app config from prop edit panel
 */
export function generateMpConfig(weapps: IWeAppData[], ctx: IBuildContext) {
  const appConfig = {
    useExtendedLib: { weui: true },
    // plugins: {
    //   'mini-shop-plugin': {
    //     version: 'latest',
    //     provider: 'wx34345ae5855f892d',
    //   },
    // },
  };

  const projConfig: any = merge({}, defaultProjConfig, {
    projectname: 'WeDa-' + ctx.appId,
  });
  const pageConfigs = weapps.map((app) => {
    const pageConfig = {};
    // #1 Get page config from mp config
    const kbConfig = app.lowCodes?.find(
      (m) => m.name === MP_CONFIG_MODULE_NAME
    );
    if (kbConfig) {
      const { pagesConfigJson = {} } = eval(
        `(${kbConfig.code.replace(/export\s+default/, '')})`
      );
      merge(pageConfig, pagesConfigJson);
    }

    // #2 Get page config from page page.data editor UI
    merge(pageConfig, getAppPagesConfig(app?.pageInstanceList || []));
    return pageConfig;
  });

  const kbConfig = weapps[0].lowCodes?.find(
    (m) => m.name === MP_CONFIG_MODULE_NAME
  );
  if (kbConfig) {
    const { projectConfigJson = {}, appJson = {} } = eval(
      `(${kbConfig.code.replace(/export\s+default/, '')})`
    );

    // # project.config.json, https://developers.weixin.qq.com/miniprogram/dev/devtools/projectconfig.html
    merge(projConfig, projectConfigJson);
    const matertialMetaIgnores = ctx.materialLibs
      .filter((lib) => !lib.isComposite)
      .reduce((arr, lib) => {
        arr.push({ type: 'file', value: `materials/${lib.name}/meta.json` });
        arr.push({
          type: 'file',
          value: `materials/${lib.name}/mergeMeta.json`,
        });
        return arr;
      }, [] as any[]);

    projConfig.packOptions.ignore.push(...matertialMetaIgnores);

    // # app.json, https://developers.weixin.qq.com/miniprogram/dev/reference/configuration/app.html
    if (appJson.tabBar) {
      parseTabConfig(appJson.tabBar, ctx.projDir);
    }
    merge(appConfig, appJson);

    // # page.json
    // merge(pageConfigs, pagesConfigJson)
  }

  // keep main app config only, ignore subapp config
  merge(
    appConfig,
    weapps[0].appConfig || {},
    extractPages(weapps, pageConfigs)
  );
  // merge(pageConfigs, extractAllPagesConfig())
  return { appConfig, projConfig, pageConfigs };
}

function extractPages(weapps: IWeAppData[], pageConfigs: any[]) {
  const pages: string[] = [];
  const subpackages: any[] = [];
  let homePage = '';
  let homePageId = '';
  weapps.forEach((weapp, index) => {
    const { rootPath } = weapp;
    const subPackage: {
      root?: string;
      pages: string[];
    } = { root: rootPath, pages: [] };
    if (rootPath) {
      subpackages.push(subPackage);
    }
    loopDealWithFn(weapp.pageInstanceList || [], (page) => {
      const pageConfig = pageConfigs[index];
      const pageFileName = get(pageConfig, `${page.id}.pageFileName`, 'index');
      if (rootPath) {
        subPackage.pages.push(`pages/${page.id}/${pageFileName}`);
      } else if (!page.isHome) {
        pages.push(`pages/${page.id}/${pageFileName}`);
      } else {
        homePage = `pages/${page.id}/${pageFileName}`;
        homePageId = page.id;
      }
    });
  });
  if (homePage) {
    pages.unshift(homePage);
  }
  return { pages, subpackages, homePageId };
}

function getAppPagesConfig(pages: IWeAppPage[]) {
  const pagesConfig = {};

  pages.map((page) => {
    const pageConfig = transformDynamicData(page.data);
    delete pageConfig['title'];
    pagesConfig[page.id] = pageConfig;
  });
  return pagesConfig;
}

function transformDynamicData(originData) {
  const temp = {};
  for (const key in originData) {
    const target = originData[key];
    if (target && target.value) {
      temp[key] = target.value;
    }
  }
  return temp;
}

function parseTabConfig(tabBar, projDir: string) {
  tabBar.list.map((tab, index) => {
    const { iconPath, selectedIconPath } = tab;
    if (iconPath) {
      tab.iconPath = parseTabIcon(iconPath, index, 'icon');
    }
    if (selectedIconPath) {
      tab.selectedIconPath = parseTabIcon(
        selectedIconPath,
        index,
        'selectedIcon'
      );
    }
  });

  function parseTabIcon(iconUrl, index, filename) {
    if (typeof iconUrl !== 'string') {
      console.error(chalk.red('App.json invalid tabbar icon path'), iconUrl);
      return;
    }
    const iconPath =
      'assets/tab' + index + '/' + filename + path.extname(iconUrl);
    downloadFile(iconUrl, projDir + '/' + iconPath).catch((e) => {
      console.error(
        chalk.red(`Fail to download tabBar icon from ${iconUrl}`),
        e
      );
    });
    return iconPath;
  }
}
