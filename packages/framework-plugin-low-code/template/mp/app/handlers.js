<% pageModules.forEach(({id: pageId, lowCodes}) => { %>
  <% lowCodes.filter(mod => mod.type === 'handler-fn' && mod.name !== '____index____').forEach(mod => {%>
    import <%= pageId%>_<%= mod.name%> from '../lowcode/<%= pageId%>/handler/<%= mod.name%>'
  <% }) %>
  <% }) %>



  <% pageModules.forEach(({id: pageId, lowCodes}) => { %>
    export const <%=pageId %> = {
      <% lowCodes.filter(mod => mod.type === 'handler-fn' && mod.name !== '____index____').forEach(mod => {%>
        <%= mod.name%>: <%= pageId%>_<%= mod.name%>,
      <% }) %>
    }
    <% }) %>
