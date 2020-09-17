// import all state of all pages & global
import globalComputed from '../lowcode/computed'
<% pageIds.forEach(function(pageId) { %>import <%= pageId %>Computed from '../lowcode/<%= pageId%>/computed';
<% }); %>

const computed = {
  global: globalComputed,<% pageIds.forEach(function(pageId) { %>
  <%= pageId %>: <%= pageId %>Computed,<% }); %>
};

export default computed;
