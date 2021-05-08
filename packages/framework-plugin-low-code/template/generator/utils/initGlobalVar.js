import { app } from '../app/global-api'
import { createComputed } from '/src/utils/computed'
import globalCommon from '../app/common'
import globalState from '../store'
import globalComputed from '../lowcode/computed'

// 防止页面重复引用
let isInit = false
if(!isInit) {
  window.$$global = window.$$global || {}
  app.common = globalCommon
  app.state = globalState
  app.computed = createComputed(globalComputed)
}
