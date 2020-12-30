<% mods.forEach((mod) => {%>
  import * as <%= mod %> from '../lowcode/common/<%= mod %>'<%}) %>

  function getModule(targetModule) {
    if(targetModule.__esModule) {
      return targetModule.default ? targetModule.default : targetModule
    }
  }

  export default {
  <% mods.forEach((mod) => {%>
    <%= mod %>: getModule(<%= mod %>),<%}) %>
  }
