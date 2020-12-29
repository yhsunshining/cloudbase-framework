const tcb = require('@cloudbase/node-sdk')
const { TCBError } = require('./_utils.js')
<% methodFileNameTup.forEach(tup => { %>
const <%=tup[0]%> = require('./<%= tup[1] %>')
<% })%>

/** 数据源对应云数据库集合名称, 数据源类型为数据库时该值才有意义 */
const COLLECTION_NAME = '<%= collectionName %>'
const app = tcb.init({
  env: tcb.SYMBOL_CURRENT_ENV
})
const auth = app.auth()
const db = app.database()

/** 自定义操作函数列表 */
const handlers = {
  <% methodFileNameTup.forEach( tup => { %>
  <%= tup[0] %>,
  <% }) %>
}

exports.main = async function (params, context) {
  // 自定义操作的context
  const cfContext = {
    cloudbase: tcb,
    app,
    auth,
    database: db,
    collection: COLLECTION_NAME ? db.collection(COLLECTION_NAME) : null
  }

  try {
    const result = await handlers[params.methodName](params.params, cfContext)
    return {
      code: 0,
      data: result
    }
  } catch (e) {
    if (e instanceof TCBError) {
      return {
        code: e.code || -1,
        message: e.message
      }
    }
    return {
      code: -1,
      message: e.message
    }
  }
}

