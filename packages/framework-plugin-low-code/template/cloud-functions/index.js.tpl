const tcb = require('@cloudbase/node-sdk')
const { TCBError } = require('./utils.js')

var __importDefault = (this && this.__importDefault) || function (mod) {
  return (mod && mod.__esModule) ? mod : { "default": mod };
};
const getMethod = __importDefault(require("./get-method"))

/** 数据源对应云数据库集合名称, 数据源类型为数据库时该值才有意义 */
const COLLECTION_NAME = '<%= collectionName %>'
const app = tcb.init({
  env: tcb.SYMBOL_CURRENT_ENV
})
const auth = app.auth()
const db = app.database()

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
    const method = getMethod.default(params.methodName)
    const result = await method(params.params, cfContext)
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

