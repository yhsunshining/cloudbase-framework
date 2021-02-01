/** 预置的错误对象, 可用该对象抛出自定义错误代码及错误信息 */
class TCBError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
    this.name = 'TCBError'
  }
}

exports.TCBError = TCBError