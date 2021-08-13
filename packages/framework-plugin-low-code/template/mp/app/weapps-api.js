import { observable } from 'mobx'
import { createComputed, formatDate, getter, setter } from '<%= subLevelPath %>../common/util'
import process from '<%= subLevelPath %>../common/process'
import { DS_SDK, CLOUD_SDK, createDataset } from '<%= subLevelPath %>../datasources/index'
import appGlobal from '<%= subLevelPath %>../app/app-global'
import weappApis from '<%= subLevelPath %>../common/weapp-sdk'

<% if (!isBare) {%>
import state from '../lowcode/state'
import computed from '../lowcode/computed'
import common from './common'
<%} else {%>
const state = {}
const computed ={}
const common = {}
<%}%>

const mainAppKey = '__weappsMainApp'

export const app = createGlboalApi()
export { process }

function createGlboalApi() {
  const globalAPI = {
    id: '<%= appId %>',
    platform: 'MINIPROGRAME',
    activePage: null,
    dataSources: DS_SDK,
    pages: {},
    session: {
      //configure: sdk.configure,
      //request: sdk.request,
      //getSessionId: sdk.getSessionId,
    },
    state: observable(state),
    computed: createComputed(computed),
    common,
    utils: {
      formatDate,
      get: getter,
      set: setter,
    },
    // ... other sdk apis & apis from mp
  } // The global api exposed to lowcode

  let dataset = createDataset('$global')
  globalAPI.dataset = dataset
  globalAPI.state.dataset = dataset
  globalAPI.setState = (userSetState) => {
    Object.keys(userSetState).forEach((keyPath) => {
      globalAPI.utils.set(globalAPI.dataset.state, keyPath, userSetState[keyPath]);
    });
  };

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
  // 避免被wx.cloud 覆盖
  globalAPI.cloud = CLOUD_SDK

  // # expose some sdk modules
  /* const sdkModsIncluded = ['flow', 'getPageOptions', 'getLaunchOptions']
  sdkModsIncluded.forEach(key => {
    globalAPI[key] = sdk[key]
  }) */
  const { scanCode } = globalAPI
  globalAPI.scanCode = (options) => {
    const {enableDefaultBehavior, ...restOptions} = options;
    const shouldReturnPromise = (!restOptions.success && !restOptions.complete && !restOptions.fail);
    if(shouldReturnPromise) {
      return new Promise((resolve, reject) => {
        scanCode(restOptions).then((res) => {
          if(enableDefaultBehavior) {
            globalAPI.showModal({
              title: '扫描到以下内容',
              content: res.result,
              showCancel: false,
            })
          }
          resolve(res)
        })
        .catch(reject)
      })
    }
  }
  return globalAPI
}
