import { TCBError } from '../datasources'

/** 自定义操作函数列表 */
export default {
  <% datasource.methods.filter(method => method.type === 'local-function').forEach( method => { %>
  '<%= method.name %>': <%= method.calleeBody.callee %>,
  <% }) %>
}
