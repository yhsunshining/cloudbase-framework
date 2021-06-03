import * as React from 'react';
import { BrowserRouter, Router, Route, Redirect, Switch, HashRouter } from 'react-router-dom';
import { history, generateBrowserHistory, generateHashHistory } from 'utils/history';

<%= mountApis %>
<%= routerImports %>

export default () => {
  // 显式声明HASH 或 app 的 路由使用 hash router，而其他web应用使用 BrowserRouter
  if (process.env.isApp || process.env.isAdminPortal || process.env.historyType === 'HASH') {
    return (
      <Router history={process.env.isAdminPortal? generateHashHistory({basename: "<%= basename %>"}) : history }>
        <Switch>
         <%= routerRenders %>
        </Switch>
      </Router>
    )
  } else {
    return (
      <Router history={generateBrowserHistory({basename: "<%= basename %>"})}>
        <Switch>
          <%= routerRenders %>
        </Switch>
      </Router>
    );
  }

}
