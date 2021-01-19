import { createComponent } from '../../../common/weapp-component'
import { mpCompToWidget } from '../../../common/widget'
import { concatClassList, px2rpx } from '../../../common/style'
import index from './lowcode/index'
import lifeCycle from './lowcode/lifecycle'
import stateFn from './lowcode/state'
import computedFuncs from './lowcode/computed'
<% handlers.forEach(h => {%>
import _handler<%= h %> from './lowcode/handler/<%= h %>' <%}) %>
import * as constObj from '../libCommonRes/const'
import * as toolsObj from '../libCommonRes/tools'

const libCode = '<%= materialName %>'

const widgetProps = <%= stringifyObj(widgetProps, {depth: null}) %>

const evtListeners = {<% Object.entries(eventHandlers).map(([handlerName, listeners])=>{%>
  <%= handlerName%>: [
    <%listeners.map(l=> { %>{
      handler: <% if (l.type == 'rematch') {%> _handler<%= l.handler %> <%} else {%> <%= l.handler %> <%} %>,
      data: <%= stringifyObj(l.data, {depth: null}) %>,
      boundData: {<% Object.entries(l.boundData).map(([prop, expr])=>{%><%= prop %>:(lists, forItems, event) => (<%= expr %>),
        <%}) %>}
    },<%})%>
  ],<%})%>
}

const behaviors = [<% if(formEvents) { %>'wx://form-field'<% } %>]

const properties = {<% Object.entries(propDefs).map(([prop, def])=> {%>
  <%= prop %>: {
    type: <%= jsonSchemaType2jsClass[def.type] %>,<%if(def.extraTypes) { %>
    optionalTypes: [<%= def.extraTypes.split('|').map(t => jsonSchemaType2jsClass[t]).join(',') %>], <% }%>
    <%if(def.default != null) {%>value: <%= JSON.stringify(def.default) %><%}%>
  },<%})%>
}

const events = [<% emitEvents.map(evtName => {%>
  {name: "<%= evtName %>", <% if(formEvents && formEvents[evtName]){%>getValueFromEvent: (event)=> <%= formEvents[evtName] %><%}%>},<%}) %>
]

const handler = {<% handlers.forEach(h => {%>
  <%= h %>: _handler<%= h %>, <%}) %>
}

const dataBinds = {<% Object.entries(dataBinds).map(([id, widgetBinds])=>{%>
  <%= id %>: { <% Object.entries(widgetBinds).map(([prop, expr]) => { %>
    <%= prop %>: function (lists, forItems, event) { return <%= expr %>; },<% }) %>
  },<%}) %>
}

const config = <%= JSON.stringify(config || {})%>

createComponent('<%= key %>', behaviors, properties, events, handler, dataBinds, evtListeners, widgetProps,
 index, lifeCycle, stateFn, computedFuncs, config, { const: constObj, tools: toolsObj }, libCode)
