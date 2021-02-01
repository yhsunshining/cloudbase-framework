const { TCBError } = require('../utils.js')

/** 单个函数生成, method.calleeBody.callee 需要是 `module.exports = function methodName(params, context){}` 形式 */

<%= method.calleeBody.callee %>
