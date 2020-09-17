import React from 'react';
import { BrowserRouter, Router, Route, Redirect, Switch } from 'react-router-dom';
import { history } from 'utils/history';

<%= mountApis %>
<%= routerImports %>

export default () => {
  // app 的 路由使用 hash router，而其他web应用使用 B srowserRouter
  if (process.env.buildType === 'app') {
    return (
      <Router history={history}>
        <Switch>
         <%= routerRenders %>
        </Switch>
      </Router>
    )
  } else {
    return (
      <BrowserRouter basename="<%= basename %>">
        <Switch>
          <%= routerRenders %>
        </Switch>
      </BrowserRouter>
    );
  }
  
}
