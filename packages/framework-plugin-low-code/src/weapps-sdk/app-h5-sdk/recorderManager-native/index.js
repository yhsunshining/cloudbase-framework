const __weappsNative = window.__weappsNative
const perCallback = 'operateRecorder'
class RecorderManager {
  constructor() {
    this.__init__()
  }
  static getInstance() {
    if (!this.instance) {
      this.instance = new RecorderManager()
    }
    return this.instance
  }
  __triggerApi__(type, object = {}) {
    const params = {
      data: {
        operationType: type,
        ...object,
      },
    }
    console.log(`__weappsNative.operateRecorder ${type} 开始执行...`, params)
    __weappsNative.operateRecorder(JSON.stringify(params))
  }
  __triggerEvent__(type, callback) {
    let callbackName = `${perCallback}_${type}`
    window[callbackName] = (err, res) => {
      let resData = JSON.parse(res);
      console.log(`__weappsNative.operateRecorder ${type} event 触发了...`, err, resData)
      
      if (type === 'onFrameRecorded') {
        if (resData.frameBuffer instanceof Array) {
          resData.frameBuffer = new Int8Array(resData.frameBuffer).buffer
        }
      }
      typeof callback === 'function' && callback(resData)
    }
    const params = {
      callback: callbackName,
      data: {
        operationType: type,
      },
    }
    console.log(`__weappsNative.operateRecorder ${type} 开始执行...`, params)
    __weappsNative.operateRecorder(JSON.stringify(params))
  }
  __init__() {
    let triggerApis = ['start', 'pause', 'resume', 'stop']
    triggerApis.forEach(api => {
      this[api] = (object = {}) => {
        this.__triggerApi__(api, object)
      }
    })
    let triggerEventApis = [
      'onFrameRecorded',
      'onInterruptionBegin',
      'onInterruptionEnd',
      'onPause',
      'onResume',
      'onStart',
      'onStop',
      'onError'
    ]
    triggerEventApis.forEach(api => {
      this[api] = (callback) => {
        this.__triggerEvent__(api, callback)
      }
    })
  }
}

export const getRecorderManager = () => {
  if(!__weappsNative) {
    console.warn('__weappsNative doesnot exsit...')
    return null
  }
  return RecorderManager.getInstance()
}
