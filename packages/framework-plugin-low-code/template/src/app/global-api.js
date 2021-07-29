import * as sdk from '@tcwd/weapps-sdk';
import { createComputed } from 'utils';
import { DS_SDK, CLOUD_SDK, createDataset, EXTRA_API } from '../datasources';
import store, { subPackageName } from '../store';
import computed from '../store/computed';
import common from './common';
import { formatDate } from '../utils/date';
import { getter, setter, _isMobile } from '../utils';
import actionMap from './material-actions';

const mainAppKey = '__weappsMainApp';
const appGlobal = process.env.isMiniprogram ? getApp() : window;

export const app = createGlboalApi();
export const $page = createPageApi();

export function setCurrentPage(pageCtx) {
  Object.assign($page, pageCtx);
}

function createGlboalApi() {
  const globalAPI = {
    id: '<%= appId %>',
    platform: 'WEB',
    formActions: {},
    pages: {},
    session: {
      configure: sdk.configure,
      request: sdk.request,
      getSessionId: sdk.getSessionId,
    },
    state: store,
    computed: createComputed(computed.global),
    common,
    dataSources: DS_SDK,
    utils: {
      formatDate,
      get: getter,
      set: setter,
    },
    // ... other sdk apis & apis from mp
  }; // The global api exposed to lowcode

  const dataset = createDataset('$global');
  globalAPI.dataset = dataset;
  globalAPI.state.dataset = dataset;
  globalAPI.setState = (userSetState) => {
    Object.keys(userSetState).forEach((keyPath) => {
      globalAPI.utils.set(
        globalAPI.dataset.state,
        keyPath,
        userSetState[keyPath]
      );
    });
  };
  /**
   * 内部通用的设置状态变量值的方法
   *  varPath 结构为 $global.<变量名> 即全局变量
   *                $page.<变量名>  即当前页面变量
   *                <pageId>.<变量名> 指定页面 pageId 的变量 (应当避免修改非当前页面的变量值)
   */
  globalAPI._setStateVal = (config) => {
    EXTRA_API.setState(config.varPath, config.val);
  };
  if (subPackageName) {
    // is sub app
    globalAPI.mainApp = appGlobal[mainAppKey];
  } else {
    // is mainApp
    appGlobal['app'] = globalAPI;
    appGlobal[mainAppKey] = globalAPI;
  }

  // 挂运营平台上报对象到app里
  globalAPI.yyptReport = appGlobal.yyptReport;

  // # expose some sdk modules
  const sdkModsIncluded = ['flow', 'getPageOptions', 'getLaunchOptions'];
  sdkModsIncluded.forEach((key) => {
    globalAPI[key] = sdk[key];
  });
  // 避免被wx.cloud 覆盖
  globalAPI.cloud = CLOUD_SDK;
  return globalAPI;
}

function createPageApi() {
  const $page = {
    state: {},
    computed: {},
    handler: {},
    props: {},
    widgets: {},
    // 页面数据源变量存储位置
    dataVar: {},
  };
  return $page;
}

// 分app 和 wx 挂载app
export const mountAPIs = (sdks) => {
  Object.keys(sdks).forEach((item) => {
    let action = sdks[item];
    if (item === 'showToast') {
      action = function (obj) {
        if (obj.icon === 'error' && !obj.image) {
          return sdks[item]({
            ...obj,
            image:
              'data:image/svg+xml,%3Csvg%20width%3D%22120%22%20height%3D%22120%22%20viewBox%3D%220,0,24,24%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M12%2010.586l5.657-5.657%201.414%201.414L13.414%2012l5.657%205.657-1.414%201.414L12%2013.414l-5.657%205.657-1.414-1.414L10.586%2012%204.929%206.343%206.343%204.93%2012%2010.586z%22%20fill-rule%3D%22evenodd%22%20fill%3D%22white%22%2F%3E%3C%2Fsvg%3E',
          });
        }
        return sdks[item](obj);
      };
    }

    if (item === 'showModal') {
      const OFFICIAL_COMPONENT_LIB = 'weda';
      const showModal =
        actionMap[OFFICIAL_COMPONENT_LIB] &&
        actionMap[OFFICIAL_COMPONENT_LIB].showModal;
      if (!_isMobile() && showModal) {
        action = function (params) {
          return showModal({ data: params });
        };
      }
    }

    app[item] = action;
  });
  return app;
};
