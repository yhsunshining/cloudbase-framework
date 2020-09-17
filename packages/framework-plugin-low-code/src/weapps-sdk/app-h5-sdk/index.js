import * as wx from 'kbone-api'
import nativeSdk, { getCommonJSSDKS } from './weapps-native-sdk'
import * as H5SDK from './h5Api'
import kboneApisIncluded from './kboneApisIncluded'
import makePhoneCall from './makePhoneCall'

function getAppApis() {
  let AppH5Sdks = {}
  kboneApisIncluded.forEach(key => {
    const val = wx[key]
    if (val) {
      AppH5Sdks[key] = val
    } else {
      AppH5Sdks[key] = () => {
        console.warn(`wx ${key} doesnot exist...`)
      }
    }
  })
  AppH5Sdks = {
    ...AppH5Sdks,
    ...getCommonJSSDKS(),
    redirectTo: H5SDK.navigateTo,
    ...H5SDK,
    native: nativeSdk,
  }
  // 优先使用小程序和web能力，如果没有则使用
  if (!process.env.isApp) {
    AppH5Sdks = {
      ...AppH5Sdks,
      makePhoneCall
    }
  }
  return AppH5Sdks
}

export default getAppApis();