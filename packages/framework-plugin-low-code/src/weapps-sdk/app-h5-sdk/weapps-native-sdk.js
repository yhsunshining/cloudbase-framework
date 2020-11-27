let id = 0
const ComCallbackName = 'jssdk__weappsNative__'
const __weappsNative = window.__weappsNative
const WeappsOnEvents = {}
let NativeSdks = [
  /**
   * 认证登陆
   */
  'weiXinLogin',
  /*
   * 认证登陆
   */
  'faceVeriftLogin',
  /**
   * 跳到签名页
   */
  'startSignPage',
  /**
   * 强制竖屏 "orientation":"vertical | horizontal"
   */
  'setScreenOrientation'

]
function injection(keys, obj) {
  keys.forEach(element => {
    if (element.includes('Sync')) {
      obj[element] = function(...args) {
        try {
          console.log(element, args, '进入函数调用Sync')
          let sdkJson = {
            data: args,
          }
          console.log('开始执行__weappsNative.Sync...', element, sdkJson, __weappsNative[element])
          console.log(`
                __weappsNative[${element}](${JSON.stringify(sdkJson)})
            `)
          let result = __weappsNative && __weappsNative[element](JSON.stringify(sdkJson))
          return result ? JSON.parse(result) : null
        } catch (e) {
          console.error(e)
        }
      }
    } else if (element.startsWith('on')) {
      let eventKey = element.substr(2)
      if (!WeappsOnEvents[eventKey]) {
        WeappsOnEvents[eventKey] = []
      }
      obj[element] = function(callback) {
        console.log(element, '进入函数调用 on')
        if (typeof callback !== 'function') {
          console.error(callback, 'is not function')
          return
        }
        WeappsOnEvents[eventKey].push(callback)
        // 只需要注册一次
        if (WeappsOnEvents[eventKey].length === 1) {
          let callbackName = ComCallbackName + element + id++
          WeappsOnEvents[eventKey].callbackName = callbackName
          window[callbackName] = function(err, args) {
            try {
              console.log(err,args,callbackName,  'jsbridge 执行了')
              WeappsOnEvents[eventKey].forEach(cb => {
                typeof cb === 'function' && cb(args ? JSON.parse(args) : null)
              })
            } catch (e) {
              console.log(e.stack, `${element} callback 调用出错`)
            }
          }
          let sdkJson = {
            callback: callbackName,
          }
          console.log('开始执行__weappsNative.on...', element, sdkJson, __weappsNative[element])
          console.log(`
              __weappsNative[${element}](${JSON.stringify(sdkJson)})
          `)
          __weappsNative && __weappsNative[element](JSON.stringify(sdkJson))
        }
      }
    } else if (element.startsWith('off')) {
      let eventKey = element.substr(3)
      obj[element] = function(callback) {
        console.log(element, '进入函数调用 off')
        if (typeof callback !== 'function') {
          console.error(callback, 'is not function')
          return
        }
        let callbackName = WeappsOnEvents[eventKey].callbackName
        if(!callbackName) {
          return
        }
        console.log(element, `WeappsOnEvents[${eventKey}]  callbackName:`, callbackName)
        let funcIndex = WeappsOnEvents[eventKey].findIndex(cb => cb === callback)
        if (funcIndex > -1) {
          WeappsOnEvents[eventKey].splice(funcIndex, 1)
        }
        // 只需要注册一次
        if (WeappsOnEvents[eventKey].length === 0) {
          let sdkJson = {
            callback: callbackName,
          }
          console.log('开始执行__weappsNative.off...', element, sdkJson, __weappsNative[element])
          console.log(`
              __weappsNative[${element}](${JSON.stringify(sdkJson)})
          `)
          __weappsNative && __weappsNative[element](JSON.stringify(sdkJson))
        }
      }
    } else {
      obj[element] = function(json={}) {
        return new Promise((res, rej) => {
          console.log(element, json, '进入函数调用 返回promise')
          let callbackName = ComCallbackName + element + id++
          window[callbackName] = function(err, args) {
            try {
              console.log(callbackName, err, args, 'jsbridge 执行了')
              if (err !== 'null') {
                let _err = err ? JSON.parse(err): null
                typeof json.fail === 'function' && json.fail(_err)
                rej(_err)
                return
              }
              let _args = args ? JSON.parse(args) : null
              typeof json.success === 'function' && json.success(_args)
              res(_args)
            } catch (e) {
              console.log(e.stack, `${element} 调用出错`)
              typeof json.fail === 'function' && json.fail(e)
              rej(e)
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
          console.log('开始执行__weappsNative...', element, sdkJson, __weappsNative[element])
          console.log(`
              __weappsNative[${element}](${JSON.stringify(sdkJson)})
            `)
          return __weappsNative && __weappsNative[element](JSON.stringify(sdkJson))
        })
      }
    }
  })
}

function makeOnlyNativeJsSDK() {
  let app = {}
  if (process.env.isApp) {
    if (!__weappsNative) {
      console.warn('window.__weappsNative 不存在，请求确认jssdk是否成功注入！')
      return app
    }
    injection(NativeSdks, app)
  }
  return app
}
export default makeOnlyNativeJsSDK()

export function getCommonJSSDKS() {
  let sdks = {}
  if (process.env.isApp) {
    if (!window.__weappsNative) {
      console.warn('window.__weappsNative 不存在，请求确认jssdk是否成功注入！')
      return sdks
    }
    let apis = Object.keys(__weappsNative).filter(key => !NativeSdks.includes(key))
    injection(apis, sdks)
  }
  return sdks
}
