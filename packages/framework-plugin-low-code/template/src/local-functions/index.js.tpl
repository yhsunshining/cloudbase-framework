<% dsSourceNames.forEach(dsName => { %>
import <%=dsName.replace(/\p{P}/gu, '_')%> from './<%= dsName%>'
<% })%>

export const localFns = {
  <% dsSourceNames.forEach(dsName => { %>
  '<%= dsName %>': <%=dsName.replace(/\p{P}/gu, '_')%>,
  <% }) %>
}
