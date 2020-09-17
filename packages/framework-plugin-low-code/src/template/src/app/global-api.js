import * as sdk from '@govcloud/weapps-sdk'
import { createComputed } from 'utils'
import store, { subPackageName } from '../store'
import computed from '../store/computed'
import common from './common'

const mainAppKey = '__weappsMainApp'
const appGlobal = process.env.isMiniprogram ? getApp() : window

export const app = createGlboalApi()
export const $page = createPageApi()

export function setCurrentPage(pageCtx) {
  Object.assign($page, pageCtx)
}

function createGlboalApi() {
  const globalAPI = {
    formActions: {},
    dataSources: {},
    pages: {},
    widgets: {},
    session: {
      configure: sdk.configure,
      request: sdk.request,
      getSessionId: sdk.getSessionId,
    },
    state: store,
    computed: createComputed(computed.global),
    common,
    // ... other sdk apis & apis from mp
  } // The global api exposed to lowcode

  if (subPackageName) {
    // is sub app
    globalAPI.mainApp = appGlobal[mainAppKey]
  } else {
    // is mainApp
    appGlobal[mainAppKey] = globalAPI
  }

  // 挂运营平台上报对象到app里
  globalAPI.yyptReport = appGlobal.yyptReport

  // # expose some sdk modules
  const sdkModsIncluded = ['flow', 'getPageOptions', 'getLaunchOptions']
  sdkModsIncluded.forEach(key => {
    globalAPI[key] = sdk[key]
  })
  return globalAPI
}

function createPageApi() {
  const $page = {
    state: {},
    computed: {},
    handler: {},
    props: {},
  }
  return $page
}

// 分app 和 wx 挂载app
export const mountAPIs = sdks => {
  Object.keys(sdks).forEach(item => {
    app[item] = sdks[item]
  })
  return app
}
