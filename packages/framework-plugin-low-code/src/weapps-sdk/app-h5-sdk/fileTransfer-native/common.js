import { createCallbackManager } from '../utils'
let id = 1
const __weappsNative = window.__weappsNative
//DownloadTask具体属性参照小程序
class LoadTask{
  constructor(taskApiName , identifier, json)  {
    this.identifier = identifier
    this.taskApiName = taskApiName
    this.json = json
    this.onProgressUpdateCb = null
    this.onHeadersReceivedCbName = null
    this.__callbackManager = {
      headersReceived: createCallbackManager(),
      progressUpdate: createCallbackManager(),
    }
  }
  abort () {
    const params = {
      data: {
        type: this.taskApiName, //为了区分downloadTask,uploadTask，requestTask
        identifier: this.identifier,
      },
    }
    __weappsNative && __weappsNative.abort(JSON.stringify(params))
    typeof this.json.error === 'function' && this.json.error({
      errMsg: `${taskApiName}:fail abort`
    })
  }
  onProgressUpdate (callback = () => {}) {
    this.__callbackManager.progressUpdate.add(callback)
    this.onProgressUpdateCb = taskApiName + this.identifier
    if (!window[this.onProgressUpdateCb]) {
      const that = this;
      window[this.onProgressUpdateCb] = function(err, args) {
        that.__callbackManager.progressUpdate.trigger(args ? JSON.parse(args) : {})
      }
      const params = {
        callback: this.onProgressUpdateCb,
        data: {
          type: taskApiName, //为了区分downloadTask,uploadTask, requestTast
          identifier: this.identifier,
        },
      }
      __weappsNative && __weappsNative.onProgressUpdate(JSON.stringify(params))
    }
  }
  offProgressUpdate (callback = () => {}) {
    this.__callbackManager.progressUpdate.remove(callback)
    if (this.__callbackManager.progressUpdate.count === 0) {
      const params = {
        callback: this.onProgressUpdateCb,
        data: {
          type: taskApiName, //为了区分downloadTask,uploadTask，requestTast
          identifier: this.identifier,
        },
      }
      __weappsNative && __weappsNative.offProgressUpdate(JSON.stringify(params))
      delete window[this.onProgressUpdateCb]
    }
  }
  onHeadersReceived (callback = () => {}) {
    this.__callbackManager.headersReceived.add(callback)
    this.onHeadersReceivedCbName = taskApiName + this.identifier
    if (!window[this.onHeadersReceivedCbName]) {
      const that = this;
      window[this.onHeadersReceivedCbName] = function(err, args) {
        that.__callbackManager.headersReceived.trigger(args ? JSON.parse(args) : {})
      }
      const params = {
        callback: this.onHeadersReceivedCbName,
        data: {
          type: taskApiName, //为了区分downloadTask,uploadTask, requestTast
          identifier: this.identifier,
        },
      }
      __weappsNative && __weappsNative.onProgressUpdate(JSON.stringify(params))
    }
  }
  offHeadersReceived(callback) {
    this.__callbackManager.headersReceived.remove(callback)
    if (this.__callbackManager.headersReceived.count === 0) {
      const params = {
        callback: this.onHeadersReceivedCbName,
        data: {
          type: taskApiName, //为了区分downloadTask,uploadTask，requestTast
          identifier: this.identifier,
        },
      }
      __weappsNative && __weappsNative.offProgressUpdate(JSON.stringify(params))
      delete window[this.onHeadersReceivedCbName]
    }
  }
}

export const createLoadTask = (apiName, taskApiName, json) => {
  const callbackName = apiName + id++
  window[callbackName] = function(err, args) {
    try {
      console.log(callbackName, err, args, 'jsbridge 执行了')
      if (err !== 'null') {
        typeof json.fail === 'function' && json.fail(JSON.parse(err))
        return
      }
      typeof json.success === 'function' && json.success({
        errMsg: `${apiName}:ok`,
        ...JSON.parse(args)
      })
    } catch (e) {
      console.log(e.stack, `${apiName} 调用出错`)
      typeof json.fail === 'function' && json.fail(e)
    } finally {
      typeof json.complete === 'function' && json.complete()
      delete window[callbackName]
    }
  }
  let data = {
    ...json,
  }
  delete data.success
  delete data.fail
  delete data.complete
  let sdkJson = {
    data,
    callback: callbackName,
  }
  console.log('开始执行__weappsNative...', apiName, sdkJson, __weappsNative[apiName])
  console.log(`__weappsNative[${apiName}](${JSON.stringify(sdkJson)})`)
  let identifier = __weappsNative && __weappsNative[apiName](JSON.stringify(sdkJson))
  

  return new LoadTask(taskApiName, identifier, json)
}
