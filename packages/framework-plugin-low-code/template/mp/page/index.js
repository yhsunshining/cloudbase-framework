import { createPage } from '<%= subLevelPath %>../../common/weapp-page'
import { mpCompToWidget } from '<%= subLevelPath %>../../common/widget'
import { concatClassList, px2rpx } from '<%= subLevelPath %>../../common/style'
import { app } from '../../app/weapps-api'
import { $page } from './api'
import { <%= pageName %> as handlers } from '../../app/handlers'
import lifecyle from '../../lowcode/<%= pageName %>/lifecycle'
import state from '../../lowcode/<%= pageName %>/state'
import computed from '../../lowcode/<%= pageName %>/computed'


const widgetProps = <%= stringifyObj(widgetProps, {depth: null}) %>
/** widget event listeners **/
const evtListeners = {<% Object.entries(eventHanlders).map(([handlerName, listeners])=>{%>
  <%= handlerName%>: [
    <%listeners.map(l=> { %>{
      key: '<%= l.key %>',
      handler: <% if (l.type === 'rematch') {%> handlers.<%= l.handler %> <%} else if (l.type == 'material') {%> function(...args) { return require('../../materials/<%= l.handlerModule %>/actions/<%= l.handler %>/index').default(...args) } <%} else {%> <%= l.handler %> <%} %>,
      // handler: <% if (l.type === 'rematch') {%> handlers.<%}%><%=l.handler%>,
      data: <%= stringifyObj(l.data, {depth: null}) %>,
      boundData: {<% Object.entries(l.boundData).map(([prop, expr])=>{%><%= prop %>:(lists, forItems, event) => (<%= expr %>),
        <%}) %>}
    },<%})%>
  ],<%})%>
}
const dataBinds = {<% Object.entries(dataBinds).map(([id, widgetBinds])=>{%>
  <%= id %>: { <% Object.entries(widgetBinds).map(([prop, expr]) => { %>
    <%= prop %>: function (lists, forItems, event) { return <%= expr %>; },<% }) %>
  },<%}) %>
}

$page.id = '<%= pageName %>'
$page.handler = handlers
createPage(lifecyle, widgetProps, state, computed, evtListeners, dataBinds, app, $page)
