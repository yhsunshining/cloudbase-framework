// import * as sdk from '@govcloud/weapps-sdk'
import { observable } from 'mobx'
import { createComputed } from '<%= subLevelPath %>../common/util'
import process from '<%= subLevelPath %>../common/process'
import state from '../lowcode/state'
import computed from '../lowcode/computed'
import common from './common'
import { createDataVar, dataSources, createDataset } from '../datasources/index'
import appGlobal from '<%= subLevelPath %>../app/app-global'
import weappApis from '<%= subLevelPath %>../common/weapp-sdk'

const mainAppKey = '__weappsMainApp'

export const app = createGlboalApi()
export { process }

function createGlboalApi() {
  const globalAPI = {
    activePage: null,
    dataSources,
    pages: {},
    session: {
      //configure: sdk.configure,
      //request: sdk.request,
      //getSessionId: sdk.getSessionId,
    },
    state: observable(state),
    // 全局数据源变量存储位置
    dataVar: createDataVar('$global'),
    computed: createComputed(computed),
    common,
    // ... other sdk apis & apis from mp
  } // The global api exposed to lowcode

  let dataset = createDataset('$global')
  globalAPI.dataset = dataset
  globalAPI.state.dataset = dataset


  // mount wx apis
  Object.assign(globalAPI, weappApis)

  const subPackageName = '<%= subPackageName %>'
  if (subPackageName) {
    // is sub app
    globalAPI.mainApp = appGlobal[mainAppKey]
    const mpApp = getApp()
    mpApp && (mpApp.subApp = globalAPI)
  } else {
    // is mainApp
    appGlobal[mainAppKey] = globalAPI
  }

  // # expose some sdk modules
  /* const sdkModsIncluded = ['flow', 'getPageOptions', 'getLaunchOptions']
  sdkModsIncluded.forEach(key => {
    globalAPI[key] = sdk[key]
  }) */
  return globalAPI
}
