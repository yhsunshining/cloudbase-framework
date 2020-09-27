const tcb = require('@cloudbase/node-sdk')
/** 数据源对应云数据库集合名称, 数据源类型为数据库时该值才有意义 */
const COLLECTION_NAME = '<%= collectionName %>'
const app = tcb.init({
  env: tcb.SYMBOL_CURRENT_ENV
})
const auth = app.auth()
const db = app.database()

/** 预置的错误对象, 可用该对象抛出自定义错误代码及错误信息 */
class TCBError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
    this.name = 'TCBError'
  }
}

/** 自定义操作函数列表 */
const handlers = {
  <% cloudFunctions.forEach( (method,index,array) => { %>
  <%= method.name %>: <%= method.calleeBody.callee %>,
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

