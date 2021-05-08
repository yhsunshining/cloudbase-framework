<% mods.forEach((mod) => {%>
  import * as <%= mod %> from '../lowcode/common/<%= mod %>'<%}) %>

  // 支持 ESM 和 WEBPACK_EMS
  function getModule(targetModule) {
    if(
      Object.prototype.toString.call(targetModule) === '[object Module]'
      || targetModule.__esModule) {
      return targetModule.default ? targetModule.default : targetModule
    }
    return targetModule.default ? targetModule.default : targetModule
  }

  export default {
  <% mods.forEach((mod) => {%>
    <%= mod %>: getModule(<%= mod %>),<%}) %>
  }
