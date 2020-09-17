// Imports all material actions
<% materials.map(material => {
  (material.actions || []).map(act => {
%>import <%= _.camelCase(material.name)%>_<%=act.name%> from 'libraries/<%=material.name%>@<%= material.version %>/actions/<%= act.name %>'
<% })
})
%>
export default {
<% materials.map(material => {
%>  ['<%= material.name%>']: {<% (material.actions || []).map(act => { %>
    <%= act.name%>: <%= _.camelCase(material.name)%>_<%=act.name%>,<%})%>
  },
<%}) %>}
