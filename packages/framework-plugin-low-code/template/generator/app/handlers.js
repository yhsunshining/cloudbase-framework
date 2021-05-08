<%for(const pageId in pageModules) {
    pageModules[pageId].filter(mod => mod.type === 'handler-fn' && mod.name !== '____index____').forEach(mod => {%>
import <%= pageId%>_<%= mod.name%> from '../lowcode/<%= pageId%>/handler/<%= mod.name%>'<%
  })
}%>

<% for(const pageId in pageModules) {%>
export const $$_<%=pageId %> = {<%
    pageModules[pageId].filter(mod => mod.type === 'handler-fn' && mod.name !== '____index____').forEach(mod => {%>
  <%= mod.name%>: <%= pageId%>_<%= mod.name%>,<%
  }) %>
}
<%}%>
