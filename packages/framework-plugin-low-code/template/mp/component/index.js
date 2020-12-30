import { createComponent } from '../../../common/weapp-component'
import { getDeep } from '../../../common/util'
import { concatClassList, px2rpx } from '../../../common/style'
import lifeCycle from './lowcode/lifecycle'
import stateFn from './lowcode/state'
import computedFuncs from './lowcode/computed'
<% handlers.forEach(h => {%>
import _handler<%= h %> from './lowcode/handler/<%= h %>' <%}) %>

const widgetProps = <%= stringifyObj(widgetProps, {depth: null}) %>

const evtListeners = {<% Object.entries(eventHandlers).map(([handlerName, listeners])=>{%>
  <%= handlerName%>: [
    <%listeners.map(l=> { %>{
      handler: <% if (l.type == 'rematch') {%> _handler<%= l.handler %> <%} else if (l.type == 'prop-event') {%> function({event, data = {}}) { <%= compApi %>.props.events.<%= l.handler %>({...event.detail, ...data}) } <%} else {%> <%= l.handler %> <%} %>,
      data: <%= stringifyObj(l.data, {depth: null}) %>,
      boundData: {<% Object.entries(l.boundData).map(([prop, expr])=>{%><%= prop %>:(forItems) => (<%= expr %>),
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
    <%= prop %>: function (forItems) { return <%= expr %>; },<% }) %>
  },<%}) %>
}

Component(createComponent(behaviors, properties, events, handler, dataBinds, evtListeners, widgetProps, lifeCycle, stateFn, computedFuncs))