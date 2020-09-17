import * as wxp from 'kbone-api'
import { getSessionId } from './session'
import { getConfig } from './config'

let showGlobalModal = false
export default function request(options, retryTime = 2) {
  // 请求是否来自 weapps 系统
  const isWeApps = !!window.isWeApps

  const config = getConfig()
  if (retryTime === 0) {
    return Promise.reject(null)
  }
  return getSessionId()
    .then(sessionid => {
      const config = getConfig()

      const configHeader = config.service?.headers || {}
      const proxyHeader = {}
      let requestUrl = fixedDomain(options.url)

      if (isWeApps) {
        proxyHeader['weapps-proxy-url'] = requestUrl
        requestUrl = `${location.origin}/api/proxy`
      }

      options.header = options.header || {}
      const header = {
        ...proxyHeader,
        ...options.header,
        'content-type': options.header['content-type'] || 'application/json',
        [config.sessionIdHeader]: sessionid,
        appid: config.service.appId,
        ...configHeader,
      }

      console.log('---------> weapps-sdk request begin', requestUrl, options, header)
      return wxp.request({
        ...options,
        url: requestUrl,
        header,
        timeout: options.timeout || 15000,
      })
    })
    .then(({ statusCode, data: resp }) => {
      console.log('---------> weapps-sdk request finish', resp)

      wxp.hideLoading()
      const { errcode, code } = resp
      if (config.needReLoginErrorCode.includes(errcode)) {
        wxp.removeStorageSync(config.storageKeySessionId)
        return request(options, retryTime - 1)
      }
      if (statusCode === 200 && (Number(errcode) === 0 || Number(code) === 0)) {
        return resp.data
      } else {
        console.error(resp.errmsg)
        throw resp
      }
    })
    .catch(err => {
      if (!showGlobalModal && !config.ignoreErrorCode.includes(err.errcode)) {
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
      throw err
    })
}

function fixedDomain(url) {
  const config = getConfig()

  if (url.indexOf('http') === 0) {
    return url
  }

  return `${config.service.domain}${url}`
}
