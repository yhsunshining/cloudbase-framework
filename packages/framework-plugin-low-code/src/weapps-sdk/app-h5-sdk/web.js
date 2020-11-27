/**
 * 使用web端的api的能力 （优先使用小程序 和 app 能力，如果没有则使用web 能力） 在非app构建时才会加入
 */
export { default as makePhoneCall} from './makePhoneCall'

export { setNavigationBarTitle, setNavigationBarColor } from './navigationBar'

export { getSystemInfo, getSystemInfoSync} from './system'
export {
  setStorage,
  setStorageSync,
  getStorage,
  getStorageSync,
  getStorageInfo,
  getStorageInfoSync,
  removeStorage,
  removeStorageSync,
  clearStorage,
  clearStorageSync
} from './storage'
