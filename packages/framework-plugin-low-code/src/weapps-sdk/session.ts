import * as wxp from 'kbone-api'
import { getConfig } from './config'
import * as url from 'url'

let fetchSessionPromise: Promise<string> | null
let showGlobalModal = false

function fetchSessionId() {
  // 请求是否来自 weapps 系统
  const isWeApps = !!process.env.isWeApps

  const config = getConfig()

  if (fetchSessionPromise) {
    return fetchSessionPromise
  }
  const { domain, getLoginUrl, appId } = config.service
  fetchSessionPromise = wxp
    .login()
    .then(({ code }) => {
      const proxyHeader = {}
      let requestUrl = domain + getLoginUrl(code)

      if (isWeApps) {
        // 转去 proxy 请求
        proxyHeader['weapps-proxy-url'] = requestUrl
        requestUrl = `${location.origin}/api/proxy`
      }

      return wxp.request({
        url: requestUrl,
        header: {
          ...proxyHeader,
          appid: appId,
        },
      })
    })
    .then(({ data }) => {
      fetchSessionPromise = null
      const { errcode } = data
      if (errcode === 0) {
        const sessionid = data.data.sessionid || data.data.sessionId
        const openid = data.data.openid || data.data.openId
        localStorage.setItem(config.storageKeyOpenId, openid)
        localStorage.setItem(config.storageKeySessionId, sessionid)
        return sessionid
      }
      throw handleSessionFail(data)
    })
    .catch(err => {
      fetchSessionPromise = null
      throw handleSessionFail(err)
    })
  return fetchSessionPromise!
}

export function getSessionId() {
  const config = getConfig()

  const sessionid = localStorage.getItem(config.storageKeySessionId)
  if (sessionid) {
    return { then: (cb: (data: any) => Promise<any>) => cb(sessionid) }
  }

  return fetchSessionId()
}

function handleSessionFail(err) {
  const config = getConfig()
  if (!showGlobalModal && !config.ignoreErrorCode.includes(err.errcode)) {
    console.log('Get session error', err)
    showGlobalModal = true
    wxp.showModal({
      title: '温馨提示',
      content: '当前网络异常，请稍后再试',
      showCancel: false,
      success: () => {
        showGlobalModal = false
      },
    })
  }

  return {
    errcode: -20000,
    errmsg: '请求 sessionId 失败',
  }
}
