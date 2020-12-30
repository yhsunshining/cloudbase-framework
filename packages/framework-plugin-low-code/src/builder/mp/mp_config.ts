import * as path from 'path'
import { merge } from 'lodash'
import { defaultProjConfig } from '../config/mp'
import { IWeAppData, IWeAppPage, loopDealWithFn } from '../../weapps-core'
import { IBuildContext } from './BuildContext'
import { MP_CONFIG_MODULE_NAME } from '../config'
import { downloadFile } from '../util/net'

/**
 * generate app.json & page.json for mp
 *
 * @param kboneConfig https://wechat-miniprogram.github.io/kbone/docs/config/
 * @param appConfigs app config from prop edit panel
 */
export function generateMpConfig(weapps: IWeAppData[], ctx: IBuildContext) {
  const appConfig = {}
  const projConfig: any = merge({}, defaultProjConfig, {
    projectname: 'WeApps-' + ctx.appId,
  })
  const pageConfigs = weapps.map((app) => {
    const pageConfig = {}
    // #1 Get page config from mp config
    const kbConfig = app.lowCodes.find((m) => m.name === MP_CONFIG_MODULE_NAME)
    if (kbConfig) {
      const { pagesConfigJson = {} } = eval(
        `(${kbConfig.code.replace(/export\s+default/, '')})`
      )
      merge(pageConfig, pagesConfigJson)
    }

    // #2 Get page config from page page.data editor UI
    merge(pageConfig, getAppPagesConfig(app.pageInstanceList))
    return pageConfig
  })

  const kbConfig = weapps[0].lowCodes.find(
    (m) => m.name === MP_CONFIG_MODULE_NAME
  )
  if (kbConfig) {
    const { projectConfigJson = {}, appJson = {} } = eval(
      `(${kbConfig.code.replace(/export\s+default/, '')})`
    )

    // # project.config.json, https://developers.weixin.qq.com/miniprogram/dev/devtools/projectconfig.html
    merge(projConfig, projectConfigJson)
    merge(projConfig, {
      packOptions: {
        ignore: ctx.materialLibs
          .filter((lib) => !lib.isComposite)
          .map((lib) => `materials/${lib.name}/meta.json`)
          .map((value) => ({ type: 'file', value })),
      },
    })

    // # app.json, https://developers.weixin.qq.com/miniprogram/dev/reference/configuration/app.html
    if (appJson.tabBar) {
      parseTabConfig(appJson.tabBar, ctx.projDir)
    }
    merge(appConfig, appJson)

    // # page.json
    // merge(pageConfigs, pagesConfigJson)
  }

  // keep main app config only, ignore subapp config
  merge(appConfig, weapps[0].appConfig || {}, extractPages(weapps))
  // merge(pageConfigs, extractAllPagesConfig())
  return { appConfig, projConfig, pageConfigs }
}

function extractPages(weapps: IWeAppData[]) {
  const pages: string[] = []
  const subPackages: any[] = []
  let homePage = ''
  weapps.forEach((weapp) => {
    const { rootPath } = weapp
    const subPackage: {
      root
      pages: string[]
    } = { root: rootPath, pages: [] }
    if (rootPath) {
      subPackages.push(subPackage)
    }
    loopDealWithFn(weapp.pageInstanceList, (page) => {
      if (rootPath) {
        subPackage.pages.push(`pages/${page.id}/index`)
      } else if (!page.isHome) {
        pages.push(`pages/${page.id}/index`)
      } else {
        homePage = `pages/${page.id}/index`
      }
    })
  })
  if (homePage) {
    pages.unshift(homePage)
  }
  return { pages, subPackages }
}

function getAppPagesConfig(pages: IWeAppPage[]) {
  const pagesConfig = {}

  pages.map((page) => {
    const pageConfig = transformDynamicData(page.data)
    delete pageConfig['title']
    pagesConfig[page.id] = pageConfig
  })
  return pagesConfig
}

function transformDynamicData(originData) {
  const temp = {}
  for (const key in originData) {
    const target = originData[key]
    if (target && target.value) {
      temp[key] = target.value
    }
  }
  return temp
}

function parseTabConfig(tabBar, projDir: string) {
  tabBar.list.map((tab, index) => {
    const { iconPath, selectedIconPath } = tab
    tab.iconPath = 'assets/tab' + index + '/icon' + path.extname(iconPath)
    tab.selectedIconPath =
      'assets/tab' + index + '/selectedIcon' + path.extname(selectedIconPath)

    downloadFile(iconPath, projDir + '/' + tab.iconPath)
    downloadFile(selectedIconPath, projDir + '/' + tab.selectedIconPath)
  })
}
