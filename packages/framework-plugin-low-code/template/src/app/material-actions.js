// Imports all material actions
<% materials.map((material,index) => { if(material.entry){ %>
import <%= _.camelCase(material.name)%>_<%= index%> from 'libraries/<%=material.name%>@<%= material.version %>/<%=material.entry%>';
const <%= _.camelCase(material.name)%>Actions_<%= index%> = <%= _.camelCase(material.name)%>_<%= index%>.actions
<% } else { (material.actions || []).map(act => {%>
import <%= _.camelCase(material.name)%>_<%=act.name%> from 'libraries/<%=material.name%>@<%= material.version %>/actions/<%= act.name %>'
<% }) }}) %>
export default {
  <% materials.map((material, index) => {
  %>  ['<%= material.name%>']:<% if(material.entry){ %> <%=_.camelCase(material.name)%>Actions_<%= index%>,
  <% }else{ %> {<% (material.actions || []).map(act => { %>
      ['<%= act.name%>']: <%= _.camelCase(material.name)%>_<%=act.name%>,<%})%>
    },
  <%}}) %>}
