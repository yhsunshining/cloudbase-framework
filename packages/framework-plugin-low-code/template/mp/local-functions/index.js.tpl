<% var localDss = datasources && datasources.filter(ds => ds.methods && ds.methods.some(m => m.type === 'local-function')) || [] %>
<% localDss.forEach(ds => { %>
import <%=ds.name.replace(/\p{P}/gu, '_')%> from './<%= ds.name%>'
<% })%>

export const localFns = {
  <% localDss.forEach(ds => { %>
  '<%= ds.name %>': <%=ds.name.replace(/\p{P}/gu, '_')%>,
  <% }) %>
}
