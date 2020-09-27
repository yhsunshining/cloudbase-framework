import { urlJoinParams } from '@govcloud/weapps-sdk'
import { promisifyAll } from 'miniprogram-api-promise'

function createNavigatorFn(fnName) {
  return function ({ pageId, packageName, params, events, success, fail, complete }) {
    const url = packageName
      ? `/${packageName}/pages/${packageName}_${pageId}/index`
      : `/pages/${pageId}/index`
    wx[fnName]({
      url: urlJoinParams(url, params),
      events,
      success,
      fail,
      complete
    })
  }
}

const navigateTo = createNavigatorFn('navigateTo')
const reLaunch = createNavigatorFn('reLaunch')
const redirectTo = createNavigatorFn('redirectTo')

const wxp = {}
promisifyAll(wx, wxp)

export default {
  ...wxp,
  navigateTo,
  reLaunch,
  redirectTo,
}
