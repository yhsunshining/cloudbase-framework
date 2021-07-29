import sdk from '@tcwd/weapps-sdk/lib/app-h5-sdk';
import { DS_SDK, CLOUD_SDK, createDataset } from '../datasources';
import { formatDate } from '../utils/date';
import { getter, setter, _isMobile } from '../utils';

export const subPackageName = '<%= subPackageName %>';
export const app = createGlboalApi();
mountAPIs(sdk);
function createGlboalApi() {
  const globalAPI = {
    id: '<%= appId %>',
    platform: 'WEB',

    formActions: {},
    pages: {},
    state: {},
    computed: {},
    common: {},
    // i18n,
    dataSources: DS_SDK,
    utils: {
      formatDate,
      get: getter,
      set: setter,
    },
  };

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

  // 给全局挂上 mainApp/subApp
  // The global api exposed to lowcode
  if (subPackageName) {
    globalAPI.mainApp = window[`$$app`];
    window[`$$subapp_${subPackageName}`] = globalAPI;
  } else {
    window['app'] = globalAPI;
    window[`$$app`] = globalAPI;
  }

  // 挂运营平台上报对象到app里
  globalAPI.yyptReport = window.yyptReport;

  // 预览区调试栏可调试
  // 暴露给复合组件，代码组件来引用
  window.app = window.app || globalAPI;

  // 避免被wx.cloud 覆盖
  globalAPI.cloud = CLOUD_SDK;
  return globalAPI;
}

export function createPageApi() {
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
function mountAPIs(sdks) {
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
      const LIB_KEY = `@weapps-materials-main-gsd-h5-react`;
      const showModal =
        window[LIB_KEY] &&
        window[LIB_KEY].actions &&
        window[LIB_KEY].actions.showModal;

      if (!_isMobile() && showModal) {
        action = function (params) {
          return showModal({ data: params });
        };
      }
    }

    app[item] = action;
  });
  return app;
}
