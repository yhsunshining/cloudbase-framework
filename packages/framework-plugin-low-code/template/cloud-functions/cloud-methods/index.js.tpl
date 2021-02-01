<% methodFileNameTup.forEach(tup => { %>
  const <%=tup[0]%> = require('./<%= tup[1] %>')
<% })%>
  
  
  /** 自定义操作函数列表 */
module.exports = {
  <% methodFileNameTup.forEach( tup => { %>
  <%= tup[0] %>,
  <% }) %>
}