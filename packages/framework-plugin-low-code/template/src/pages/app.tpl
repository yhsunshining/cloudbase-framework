// Import Libs and Handlers
import * as React from 'react'
import { observable } from 'mobx'
import { AppRender } from 'handlers/render'
import { initLifeCycle, pageLifeCycleMount } from 'handlers/lifecycle'
import { createComputed } from 'utils'
import AppLifeCycle from 'lowcode/lifecycle'
import { createDataset, createStateDataSourceVar, generateParamsParser, EXTRA_API } from '../../datasources'
import PageLifeCycle from '../../lowcode/<%= pageName %>/lifecycle'
import initPageState from '../../lowcode/<%= pageName %>/state'
import computed from '../../lowcode/<%= pageName %>/computed'
import { $$_<%= pageName %> as handler } from '../../app/handlers'
import { app as mainApp } from 'app/global-api' // 取主包app
import { app, $page } from '../../app/global-api' // 取对应子包app
import { createWidgets, retryDataBinds, resolveComponentProps } from 'handlers/utils'
import { useScrollTop } from 'handlers/hooks'
import './index.less'

let ReactDOMServer;

if(process.env.SSR) {
  ReactDOMServer = require('react-dom/server');
}

// Import dependencies entry
<%= entryImports %>

// Import Components
<%= componentImports %>

// Import Plugins
<%= pluginImports %>

// Import Actions
<%= actionImports %>

// Actions

// Plugin
const pluginInstances = <%= pluginInstances %>;
const virtualFields = <%= virtualFields %>;
const componentSchema = <%= componentSchema %>;
const pageListenerInstances = <%= pageListenerInstances %>;
const widgetsContext = <%= widgets %>;
const dataBinds = <%= dataBinds %>;

AppLifeCycle.beforeCustomLaunch = (query)=>{
  EXTRA_API.setParams('$global', query || {})
  createStateDataSourceVar('$global',generateParamsParser({app}))
};
PageLifeCycle.beforePageCustomLaunch = (query) => {
  EXTRA_API.setParams('<%= pageName %>', query || {})
  createStateDataSourceVar('<%= pageName %>',generateParamsParser({app, $page}))
};
// lifecycle
initLifeCycle({
  ...AppLifeCycle,
  ...PageLifeCycle
}, app, mainApp)


// Init
export default function App() {
  useScrollTop()

  Object.assign($page, {
    id:'<%= pageName %>',
    state: observable(initPageState),
    computed: createComputed(computed),
    handler
  })
  let dataset = createDataset('<%= pageName %>', {app, $page})
  $page.dataset = dataset
  $page.state.dataset = dataset
  $page.setState = (userSetState) => {
    Object.keys(userSetState).forEach((keyPath) => {
      app.utils.set($page.dataset.state, keyPath, userSetState[keyPath]);
    });
  };

  $page.widgets = createWidgets(widgetsContext, dataBinds, {})
  // widgets 内的 dataBinds 可能需要关联 widgets，需要重新执行 dataBinds
  retryDataBinds()
  // Web 环境页面级别生命周期
  if (!process.env.isMiniprogram) {
    React.useEffect(() => {
      document.title = "<%= title %>"
    }, [])
    pageLifeCycleMount(React.useEffect, PageLifeCycle, app)
  }

  return (
    <div className="weapps-page">
      <AppRender
        pageListenerInstances={pageListenerInstances}
        virtualFields={virtualFields}
        componentSchema={componentSchema}
      />
    </div>
  );
}

export function renderToString() {
  return ReactDOMServer.renderToString(<App />);
}
