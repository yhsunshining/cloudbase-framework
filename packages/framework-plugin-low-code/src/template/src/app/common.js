<% mods.forEach((mod) => {%>
import * as <%= mod %> from '../lowcode/common/<%= mod %>'<%}) %>

export default {
<% mods.forEach((mod) => {%>
  <%= mod %>,<%}) %>
}
