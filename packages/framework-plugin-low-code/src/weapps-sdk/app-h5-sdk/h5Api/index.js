
import { fromByteArray, toByteArray } from 'base64-js'
import queryString from "querystring";
import { createAsyncFunc } from '../utils/tools'

export { pageScrollTo } from '../scroll'
export { default as chooseLocation } from '../location/chooseLocation'
export { createSelectorQuery } from '../createSelectorQuery'
// export { uploadFile, downloadFile } from '../fileTransfer-native'
// export { getRecorderManager } from '../recorderManager-native'
// 做tree-shaking按需引入
export let getRecorderManager
export let uploadFile
export let downloadFile
if (process.env.isApp) {
  getRecorderManager = require('../recorderManager-native').getRecorderManager
  uploadFile = require('../fileTransfer-native').uploadFile
  downloadFile = require('../fileTransfer-native').downloadFile
}
export {
  connectSocket,
  onSocketOpen,
  onSocketError,
  sendSocketMessage,
  onSocketMessage,
  closeSocket,
  onSocketClose
} from '../webSocket'

export { setConfig } from '../setConfig'
export { navigateTo, switchTab, reLaunch } from '../router'

export function arrayBufferToBase64 (arrayBuffer) {
  return fromByteArray(arrayBuffer)
}

export function base64ToArrayBuffer (base64) {
  return toByteArray(base64)
}
export function navigateBack(json = {}) {
  let delta = -( ~~json.delta|| 1 )
  history.go(delta)
}

export function nextTick(cb) {
 setTimeout(cb, 0);
}

export function onError(cb) {
  window.addEventListener('error', cb, false)
}

export function getSetting(json={}) {
  return createAsyncFunc(json, { authSetting: {}}, 'err')
}

export function getLaunchOptionsSync() {
  let query = queryString.parse(location.search.replace('?', ''))
  return {
    path: location.hash,
    query,
    referrerInfo: {},
    scene: undefined,
    shareTicket: undefined
  }
}

export const env = {}

export { default as os } from '../os'
