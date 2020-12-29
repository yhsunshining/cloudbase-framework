<% methodFileNameTup.forEach(tup => { %>
import <%=tup[0]%> from './<%= tup[1]%>'
<% })%>

/** 自定义操作函数列表 */
export default {
  <% methodFileNameTup.forEach( tup => { %>
  <%= tup[0] %>,
  <% }) %>
}

