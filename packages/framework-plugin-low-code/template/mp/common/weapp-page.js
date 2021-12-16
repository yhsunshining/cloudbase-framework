import { observable } from 'mobx';
import { createComputed, createEventHandlers, checkAuth } from './util';
import { createWidgets, createInitData, disposeWidget } from './widget';
import mergeRenderer from './merge-renderer';
import { createDataset, EXTRA_API, createStateDataSourceVar, generateParamsParser, setConfig } from '../datasources/index';

export function createPage(
  lifecycle,
  widgetProps,
  pageState,
  pageComputed,
  evtListeners,
  dataBinds,
  app,
  $page,
) {
  $page.state = observable(pageState);
  let dataset = createDataset($page.uuid);
  $page.dataset = dataset;
  $page.state.dataset = dataset;
  $page.computed = createComputed(pageComputed);
  $page.setState = (userSetState) => {
    Object.keys(userSetState).forEach((keyPath) => {
      app.utils.set($page.dataset.state, keyPath, userSetState[keyPath]);
    });
  };
  const evtHandlers = createEventHandlers(evtListeners);

  function extractLifecyles() {
    const result = { ...lifecycle };
    const nameMaps = [
      ['onReady', 'onPageReady'],
    ];
    nameMaps.forEach(e => {
      if (!result[e[0]] && result[e[1]]) {
        result[e[0]] = result[e[1]];
        delete result[e[1]];
      }
    });
    return result;
  }

  return Component({
    _componentType: 'page',
    data: createInitData(widgetProps, dataBinds),
    lifetimes: {
      attached() {
        // createWidgets 从上面移到这里是为了 i18n 切换语言的时候页面能生效
        $page.widgets = {};
        const { rootWidget, widgets } = createWidgets(widgetProps, dataBinds, $page.widgets);
        this._rootWidget = rootWidget;
        this._widgets = widgets;
        this._pageActive = true;
        this._disposers = this.initMergeRenderer(widgets);
      },
      detached() {
        disposeWidget(this._rootWidget);
      },
    },
    pageLifetimes: {
      // 组件所在页面的生命周期函数，定义下给运营平台上报用
      show: function () {
      },
      hide: function () {
      },
    },
    methods: {
      _pageActive: true,
      /** page lifecycles **/
      ...extractLifecyles(),
      ...evtHandlers,
      ...mergeRenderer,
      onLoad(options) {
        app.activePage = $page;
        setConfig({ currentPageId: $page.uuid });
        this._pageActive = true;

        let query = decodePageQuery(options || {});
        EXTRA_API.setParams($page.uuid, query);
        createStateDataSourceVar($page.uuid, generateParamsParser({ app, $page }));

        const hook = lifecycle.onLoad || lifecycle.onPageLoad;
        hook && hook.call(this, query);
      },
      onUnload() {
        this._disposers.forEach(dispose => dispose());

        const hook = lifecycle.onUnload || lifecycle.onPageUnload;
        hook && hook.call(this);
      },
      async onShow() {
        app.activePage = $page;
        setConfig({ currentPageId: $page.uuid });
        $page.widgets = this._widgets;
        this._pageActive = true;

        const hook = lifecycle.onShow || lifecycle.onPageShow;
        hook && hook.call(this);

        // 权限检查
        if (await checkAuth(app, app.id, app.activePage.id)) {
          this.setData({
            weDaHasLogin: true,
          });
        }
      },
      onHide() {
        const hook = lifecycle.onHide || lifecycle.onPageHide;
        hook && hook.call(this);
        this._pageActive = false;
      },

      getWeAppInst: () => $page,
    },
  });
}

function decodePageQuery(query) {
  return Object.keys(query)
    .reduce((decoded, key) => {
      decoded[key] = decodeURIComponent(query[key]);
      return decoded;
    }, {});
}
