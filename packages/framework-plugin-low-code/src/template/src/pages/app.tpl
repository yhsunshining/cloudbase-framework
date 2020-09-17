// Import Libs and Handlers
import React, { useEffect } from 'react'
import { observable } from 'mobx'
import { AppRender } from 'handlers/render'
import { initLifeCycle, pageLifeCycleMount } from 'handlers/lifecycle'
import { createComputed } from 'utils'
import AppLifeCycle from 'lowcode/lifecycle'
import PageLifeCycle from '../../lowcode/<%= pageName %>/lifecycle'
import initPageState from '../../lowcode/<%= pageName %>/state'
import computed from '../../lowcode/<%= pageName %>/computed'
import { <%= pageName %> as handler } from '../../app/handlers'
import { app as mainApp } from 'app/global-api' // 取主包app
import { app, $page } from '../../app/global-api' // 取对应子包app
import './index.less'

let ReactDOMServer;

if(process.env.SSR) {
  ReactDOMServer = require('react-dom/server');
}

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

// lifecycle
initLifeCycle({
  ...AppLifeCycle,
  ...PageLifeCycle
}, app, mainApp)

// Init
export default function App() {
  Object.assign($page, {
    id:'<%= pageName %>',
    state: <% if (isComposite) { %>initPageState<% } else { %>observable(initPageState)<% } %>,
    computed: createComputed(computed),
    handler,
    <% if (isComposite) { %>props: <%= JSON.stringify(compProps).replace(/"\$\$EVENT_(.*?)\$\$"/g, 'function(...args){ console.log(">>> call: $1"); console.log(">>> args:", args) }') %><% } %>
  })
  <% if (isComposite) { %>
  // state 会引用 props 的值
  $page.state = observable($page.state.call())
  Object.defineProperty($page, 'actions', {
    get() {
      return app.formActions
    }
  })
  <% } %>

  // Web 环境页面级别生命周期
  if (!process.env.isMiniprogram) {
    pageLifeCycleMount(useEffect, PageLifeCycle, app)
  }

  return (
    <div className="weapps-page">
      <AppRender
        ref={ref => {
          if (ref) {
            app.formActions = ref.FormActions
          }
        }}
        pageListenerInstances={pageListenerInstances}
        virtualFields={virtualFields}
        componentSchema={componentSchema}
        pluginInstances={pluginInstances}
      />
    </div>
  );
}

export function renderToString() {
  return ReactDOMServer.renderToString(<App />);
}
