import * as React from 'react';
import { BrowserRouter, Router, Route, Redirect, Switch, HashRouter } from 'react-router-dom';
import { history, generateBrowserHistory, createHistory } from '../utils/index';
import { wx } from '@tcwd/weapps-sdk'

<%= mountApis %>
<%= routerImports %>

import lifecycle from '../lowcode/lifecycle'
function NotFound() {
  lifecycle.onAppPageNotFound && lifecycle.onAppPageNotFound()
  console.error('页面 404，可以在生命周期配置 onAppPageNotFound 并跳转到对应页面')
  return <>页面404</>
}
function Loading() {
  React.useEffect(() => {
    wx.showLoading()
    return () => wx.hideLoading()
  }, [])
  return <></>
}
export default () => {
  window.$$global.homePageId = '<%= homePageId %>'
  // 显式声明HASH 或 app 的 路由使用 hash router，而其他web应用使用 BrowserRouter
  if (process.env.isApp || process.env.isAdminPortal || <%= isHash %>) {
    return (
      <Router history={history}>
        <React.Suspense fallback={<Loading/>}>
          <Switch>
            <%= routerRenders %>
            <Route component={NotFound} />
          </Switch>
        </React.Suspense>
      </Router>
    )
  } else {
    return (
      <Router history={generateBrowserHistory({basename: "<%= basename %>"})}>
        <React.Suspense fallback={<Loading/>}>
          <Switch>
            <%= routerRenders %>
            <Route component={NotFound} />
          </Switch>
        </React.Suspense>
      </Router>
    )
  }

}
