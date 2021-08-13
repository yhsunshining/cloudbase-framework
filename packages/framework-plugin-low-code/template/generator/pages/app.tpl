// Import Libs and Handlers
import * as React from 'react'
import { observable, autorun, reaction } from 'mobx'
import { observer } from "mobx-react-lite";
import get from 'lodash.get'
import { app } from '../../app/global-api' // 取对应子包app
import '../../utils/initGlobalVar'
import { AppRender } from '/src/handlers/RenderWrapper'
import { createDataset, createStateDataSourceVar, generateParamsParser, EXTRA_API } from '../../datasources'
import { createComputed, createWidgets, retryDataBinds, bindFuncObj, resolveComponentProps } from '/src/utils/index'
import { pageLifeCycleMount } from '/src/utils/lifecycle'
import { useScrollTop } from '/src/utils/hooks'
import PageLifeCycle from '../../lowcode/<%= pageName %>/lifecycle'
import initPageState from '../../lowcode/<%= pageName %>/state'
import computed from '../../lowcode/<%= pageName %>/computed'
import pageAPI from '../../lowcode/<%= pageName %>/index';
import { $$_<%= pageName %> as handler } from '../../app/handlers'
import { createPageApi } from '/src/app/global-api' // 取主包app

import '../../lowcode/<%= pageName %>/style.css'

// Import Components
<% useComponents.forEach(compItem => {%>
<% if(isSandbox) { %>
const <%= upperFirst(compItem.variableName) %> = window["@weapps-materials-main-<%= compItem.materialName %>"].components["<%= compItem.name %>"];
<% } else if(!isSandbox) { %>
import <%= upperFirst(compItem.variableName) %> from "/src/libraries/<%= compItem.materialName %>@<%= compItem.materialVersion %>/components/<%= compItem.name %>";
<% }}) %>

// Import Actions
<% useActions.forEach(action => {%>
<% if(isSandbox) { %>
const <%= action.variableName %> = window["@weapps-materials-main-<%= action.materialName %>"].actions["<%= action.name %>"];
<% } else { %>
import <%= action.variableName %> from "/src/libraries/<%= action.materialName %>@<%= action.materialVersion %>/actions/<%= action.name %>";
<% }}) %>

const virtualFields = {
  <% useComponents.forEach(compItem => {%>
  <% if(compItem.isPlainProps) { %>
  '<%= compItem.materialName %>:<%= compItem.name %>': (props) => <<%= upperFirst(compItem.variableName) %> {...resolveComponentProps(props)} pageVirtualFields={virtualFields}/>,
  <% } else { %>
  '<%= compItem.materialName %>:<%= compItem.name %>': (props) => <<%= upperFirst(compItem.variableName) %> {...props} pageVirtualFields={virtualFields}/>,
  <% }}) %>
};

// Init
export default function App() {
  // 检查权限
  // const [weDaHasLogin, setWeDaHasLogin] = React.useState(false);

  // 兼容 this.state / $page.state 两种模式
  const pageCodeContext = createPageApi()
  const $page = pageCodeContext
  Object.defineProperty(pageCodeContext, '$page', {
    get() {
      return pageCodeContext
    }
  })

  const widgetsContext = <%= widgets %>;
  const dataBinds = $page._dataBinds = <%= dataBinds %>;
  const componentSchema = <%= componentSchema %>;

  Object.assign($page, {
    id:'<%= pageName %>',
    state: observable(initPageState),
    computed: createComputed(computed, pageCodeContext),
    handler: bindFuncObj(handler, pageCodeContext)
  })
  let dataset = createDataset('<%= pageName %>', {app, $page: pageCodeContext})
  $page.dataset = dataset
  $page.state.dataset = dataset
  $page.setState = (userSetState) => {
    Object.keys(userSetState).forEach((keyPath) => {
      app.utils.set($page.dataset.state, keyPath, userSetState[keyPath]);
    });
  };

  $page.widgets = createWidgets(widgetsContext, dataBinds)
  // widgets 内的 dataBinds 可能需要关联 widgets，需要重新执行 dataBinds
  retryDataBinds()

  // Web 环境页面级别生命周期
  React.useEffect(() => {
    document.title = "<%= title %>";
    initWatchMethods(pageCodeContext)
    /*checkAuth(app, app.id, '<%= pageName %>').then((checkAuthResult) =>
      setWeDaHasLogin(checkAuthResult)
    );*/
  }, [])

  pageLifeCycleMount(
    React.useEffect,
    {
      ...PageLifeCycle,
      beforePageCustomLaunch: (query) => {
        EXTRA_API.setParams('<%= pageName %>', query || {})
        createStateDataSourceVar('<%= pageName %>', generateParamsParser({ app, $page: pageCodeContext }))
      },
    },
    app,
    pageCodeContext
  )
  // 切换页面滚动到顶部
  useScrollTop()
  return (
    <div className="weapps-page weapps-page-<%= pageClass %>">
      <AppRender
        virtualFields={virtualFields}
        componentSchema={componentSchema}
        codeContext={pageCodeContext}
      />
    </div>
  );

  function initWatchMethods(pageContext) {
    const { watch = {}, watchState = {}, watchWidget = {}, watchEffects = {}} = pageAPI


    // # watch effect
    const watchEffectDisposers = Object.keys(watchEffects).map(fnName => {
      return autorun(watchEffects[fnName].bind(pageContext))
    })
    const disposers = watchEffectDisposers

    // # watch state
    Object.keys(watchState).map(key => runWatcher(parseWatcher(watchState[key]), pageContext.state, key, 'watchState'))

    // # watch widgets
    Object.keys(watchWidget).map(key => runWatcher(parseWatcher(watchWidget[key]), pageContext.widgets, key, 'watchWidgets'))

    function runWatcher({ handler, immediate } = {}, target, key, label) {
      if (!handler) {
        console.error(`Invalid ${label}(${key}) of ${pageContext.node.widgetType}, watch must a function or {handler: function}`)
        return
      }
      const disposer = reaction(() => get(target, key), handler.bind(pageContext), { fireImmediately: immediate })
      disposers.push(disposer)
    }
  }
}

function parseWatcher(watcher) {
  if (!watcher) return
  if (watcher instanceof Function) {
    return { handler: watcher, immediate: false }
  }
  const { handler, immediate = false } = watcher
  if (!(handler instanceof Function)) return
  return { handler, immediate }
}
