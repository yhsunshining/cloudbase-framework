/* eslint-disable @typescript-eslint/no-empty-function */
/**
 * 生命周期处理函数
 */
import throttle from 'lodash.throttle';
import * as querystring from 'query-string';
import appLifeCycle from '../lowcode/lifecycle';

// 小程序 端使用lifeCycle
let alreadyInitAppLifeCycle = false;
export function initAppLifeCycle(app, { beforeCustomLaunch }) {
  const onAppLaunch = (query) => {
    beforeCustomLaunch(query);
    appLifeCycle?.onAppLaunch(query);
  };
  // 应用级别事件监听
  if (!alreadyInitAppLifeCycle) {
    onAppLaunch(app.getLaunchOptionsSync());
    appLifeCycle?.onAppShow(app.getLaunchOptionsSync());

    // 预留等客户端来触发
    // window.addEventListener('appLaunch', (...args) => onAppLaunch(...args))
    window.addEventListener('appShow', (...args) =>
      appLifeCycle?.onAppShow(...args)
    );
    window.addEventListener('appHide', (...args) =>
      appLifeCycle?.onAppHide(...args)
    );
    window.addEventListener('error', (...args) =>
      appLifeCycle?.onAppError(...args)
    );
    window.addEventListener('unhandledrejection', (event) =>
      appLifeCycle?.onAppUnhandledRejection(event?.reason)
    );
    alreadyInitAppLifeCycle = true;
  }
}

let isReachBottom = false;
// web 端使用lifeCycle
export function pageLifeCycleMount(
  useEffect,
  {
    beforePageCustomLaunch,
    onPageLoad,
    onPageShow,
    onPageReady,
    onPageHide,
    onPageUnload,
    onPullDownRefresh,
    onReachBottom,
    onShareAppMessage,
    onPageScroll,
    onResize,
    onAddToFavorites,
    onShareTimeline,
    onTabItemTap,
  },
  app = {},
  pageCodeContext
) {
  // 预览区调试栏可调试
  window.$page = pageCodeContext;
  // royhyang 此处个人认为应该走调用一次的方案
  useEffect(() => {
    const _onPageLoad = async function (query) {
      (await beforePageCustomLaunch) && beforePageCustomLaunch(query);
      return typeof onPageLoad === 'function' ? onPageLoad(query) : () => {};
    };
    _onPageLoad.call(pageCodeContext, getCurrentPageQuery());
  }, []);

  useEffect(() => {
    typeof onPageReady === 'function' && onPageReady.call(pageCodeContext);
    typeof onPageShow === 'function' && onPageShow.call(pageCodeContext);
    if (typeof onPullDownRefresh === 'function') {
      app.onPullDownRefresh && app.onPullDownRefresh(onPullDownRefresh);
    }
    if (
      typeof onPageScroll === 'function' ||
      typeof onReachBottom === 'function'
    ) {
      window.onscroll = throttle(() => {
        //变量scrollTop是滚动条滚动时，滚动条上端距离顶部的距离
        let scrollTop =
          document.documentElement.scrollTop || document.body.scrollTop;

        //变量windowHeight是可视区的高度
        let windowHeight =
          document.documentElement.clientHeight || document.body.clientHeight;

        //变量scrollHeight是滚动条的总高度（当前可滚动的页面的总高度）
        let scrollHeight =
          document.documentElement.scrollHeight || document.body.scrollHeight;
        if (typeof onPageScroll === 'function') {
          onPageScroll.call(pageCodeContext, {
            scrollTop: window.pageYOffset,
          });
        }

        // console.log(scrollTop, windowHeight, scrollTop + windowHeight, scrollHeight, isReachBottom)
        //滚动条到底部
        if (scrollTop + windowHeight >= scrollHeight && !isReachBottom) {
          //要进行的操作
          isReachBottom = true;
          if (typeof onReachBottom === 'function') {
            onReachBottom.call(pageCodeContext);
          }
        }
        // 容许用户回弹50然后执行ReachBottom， 50为测试最佳值
        if (scrollTop + windowHeight < scrollHeight - 50) {
          isReachBottom = false;
        }
      }, 300);
    }
    // todo
    if (typeof onShareAppMessage === 'function') {
      window.onShareAppMessage = onShareAppMessage.bind(pageCodeContext);
    }

    if (typeof onResize === 'function') {
      window.onresize = () => {
        onResize.call(pageCodeContext, {
          size: {
            windowWidth: window.innerWidth,
            windowHeight: window.innerHeight,
          },
        });
      };
    }
    return () => {
      typeof onPageHide === 'function' && onPageHide.call(pageCodeContext, {});
      typeof onPageUnload === 'function' &&
        onPageUnload.call(pageCodeContext, {});
      if (typeof onPullDownRefresh === 'function') {
        app.offPullDownRefresh &&
          app.offPullDownRefresh(onPullDownRefresh.bind(pageCodeContext));
      }

      window.onscroll = null;
      window.onresize = null;
    };
  }, []);
}

function getCurrentPageQuery() {
  let queryText = location.href.split('?')[1];
  let query = querystring.parse(queryText) || {};
  Object.keys(query).forEach((key) => {
    query[key] = decodeURIComponent(query[key]);
  });
  return query;
}

export function initWebConfig(app, appConfig) {
  // miniprogram.config 配置截取
  app.setConfig(appConfig);
}
