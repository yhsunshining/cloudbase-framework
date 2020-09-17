import * as utils from './utils'
import * as kbone from 'kbone-api'

const events = {
  on: window.$$subscribe,
  off: window.$$unsubscribe,
  emit: window.$$publish,
}

function getFlowEventName(pageName: string) {
  return `weapps_flow_${pageName}`
}

function getPageName(url: string) {
  return url.split('/').slice(-1)[0]
}

function getFlowEventMap(pageName: string) {
  return window.$$global[getFlowEventName(pageName)]
}

// 创建流程
export function createFlow(url: string, options: any = {}) {
  const startPageLength = getCurrentPages().length
  const pageName = getPageName(url)
  const successEvent = `${pageName}-${utils.generateGUID()}`
  const failEvent = `${pageName}-${utils.generateGUID()}`
  window.$$global[getFlowEventName(pageName)] = {
    successEvent,
    failEvent,
  }

  const urlWithOptions = utils.urlJoinParams(url, {
    successEvent,
    failEvent,
    ...options,
  })

  return new Promise((resolve, reject) => {
    events.off(successEvent)
    events.off(failEvent)

    console.log('kbone flow 绑定事件', successEvent)
    events.on(successEvent, (data: any) => {
      console.log('-------------')
      console.log('流程成功接收到事件', successEvent, data, options)
      if (options.isKeepFlowPage) {
        // 保存到当前页面
        resolve(data)
      } else {
        // 如果是弹回流程开始页
        console.log('流程：', url)
        console.log('栈：', getCurrentPages())
        console.log('起始栈数：', startPageLength)
        console.log('当前栈数：', getCurrentPages().length)
        console.log('数据：', data)
        utils.navigateBack(getCurrentPages().length - startPageLength).then(() => {
          resolve(data)
        })
      }
      console.log('-------------')
    })
    events.on(failEvent, (err: Error) => reject(err))

    console.log('跳转流程：', urlWithOptions)
    kbone
      .navigateTo({
        url: urlWithOptions,
      })
      .catch(e => console.error(e))
  })
}

export function flowSuccess(data) {
  const currentRoute = getCurrentPages().slice(-1)[0].route as unknown
  const pageName = getPageName(currentRoute as string)
  const { successEvent } = getFlowEventMap(pageName)
  events.emit(successEvent, data)
}

export function flowFail(err) {
  const currentRoute = getCurrentPages().slice(-1)[0].route as unknown
  const pageName = getPageName(currentRoute as string)
  const { failEvent } = getFlowEventMap(pageName)
  events.emit(failEvent, err)
}
