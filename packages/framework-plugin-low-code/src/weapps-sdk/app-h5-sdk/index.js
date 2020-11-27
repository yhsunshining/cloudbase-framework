import * as wx from 'kbone-api'
import nativeSdk, { getCommonJSSDKS } from './weapps-native-sdk'
import * as H5SDK from './h5Api'
import kboneApisIncluded from './kboneApisIncluded'
import * as WEBSDK from './web'

function getAppApis() {
  let AppH5Sdks = {}
  kboneApisIncluded.forEach(key => {
    const val = wx[key]
    if (val) {
      AppH5Sdks[key] = val
    } else {
      AppH5Sdks[key] = () => {
        console.warn(`app.${key} doesnot support...`)
      }
    }
  })
  // 非 APP 构建中 使用app挂载的api能力 如 构建的h5应用以及 weapps-web中使用
  if (!process.env.isApp) {
    AppH5Sdks = {
      ...AppH5Sdks,
      /**
     * 重要提示：
     *  web中才会使用 如添加请放到  ./web 文件中export
     */
      ...WEBSDK // 默认 web中才会使用的api
    }
  } else {
    // APP 构建中 使用app挂载的api能力
    AppH5Sdks = {
      ...AppH5Sdks,
      ...getCommonJSSDKS(), // 使用原生 __weappsNative 的key 值覆盖一遍
      native: nativeSdk, // 挂载 __weappsNative  native 原生的api， wx没有的api
    }
  }

  AppH5Sdks = {
    ...AppH5Sdks,
    /**
     * 重要提示：
     *  优先级最高，如添加请放到  ./h5Api 文件中export
     */
    ...H5SDK, // 使用web 或者 web与native混合的能力，
  }
  return AppH5Sdks
}

export default getAppApis();
