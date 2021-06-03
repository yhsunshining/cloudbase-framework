import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { setConfig } from '@cloudbase/weda-cloud-sdk/dist/h5'
import App from './router'
import './utils/monitor-jssdk.min'
import './index.less'
// 引入数据源管理器并进行初始化
import './datasources'
import { initGlobalVar } from './handlers/initWebEnv'
import '@babel/polyfill/noConflict'
import attachFastClick from 'fastclick'
import { initWebConfig } from 'handlers/lifecycle'
const AppConfig = require('../webpack/miniprogram.config')
import { app } from './app/global-api'
// app 中注册配置页面以及app的全局配置miniprogram.config，h5里分app以及web页分别处理，使用process.env.isApp 区分判断
if (process.env.isApp) {
  initWebConfig(app, AppConfig);
}
attachFastClick && attachFastClick.attach && attachFastClick.attach(document.body)

// 设置数据源请求的 loading 及 toast 处理
setConfig({
  beforeDSRequest: (cfg) => {
    if (!cfg.options || !cfg.options.showLoading) return
    app.showLoading()
  },
  afterDSRequest: (cfg, error, result) => {
    if (!cfg.options) return
    if (cfg.options.showLoading) app.hideLoading()
    if (!cfg.options.showToast) return
    const isSuccess = !error && result && !result.code
    app.showToast({icon: isSuccess ? 'success' : 'error'})
  }
})
// window.app.yyptReport = window.yyptReport

if (yyptReport && typeof yyptReport.pgvMain == 'function') {
  // report_url,appKey必填
  yyptReport.pgvMain({
    appKey: '<%= yyptAppKey %>', // 填入你申请的运营平台的应用key(必填)
    report_url: '<%= reportUrl %><%= yyptAppKey %>', // 上报url（把后端上报接口需要先挂网关，该url填写网关地址）
    autoReportPv: true, // 单页应用监听页面路径改变自动上报Pv，默认为false
    stopReport: <%= stopReport %>, // 停止上报
    // 其他参数说明
    // customUserPrams: null, // 用户自定义的额外属性--对于小马的用户属性，比如用户的部门编码(customUserPrams: { deptno: 1100 })需要在小马系统事先配置好
    //userKey: "user_id", // cookie里面用户的唯一标示
    //autoWatchClick: true, // 默认开启自动监听hottag
    //isWxEnv: false// 是否微信环境，微信环境会通过wx.getNetworkType获取网络环境
    // 通过传入函数，可以让业务方写代码传入要上报的属性，比如返回自定义属性，这里主要也是自定义属性，让sdk获取并且进行上报，减少重复编码
    //getCusParams: function () {
    //  return {kv:{money:1}}; //kv:Key-Value,自定义事件Key-Value参数对	map	JSON格式，在报表页面的事件参数分析页和页面参数分析页中可以看到上报的kv值
    //},
  })
}

initGlobalVar()
;(function() {
  function flex() {
    try {
      let htmlDom = document.documentElement
      let width = window.innerWidth || htmlDom.clientWidth
      let fontSize = width / (375 / 14)
      if (
        !navigator.userAgent.match(
          /(phone|pad|pod|iPhone|iPod|ios|iPad|Android|Mobile|IEMobile)/i
        ) &&
        fontSize > 14
      ) {
        htmlDom.style.fontSize = `14px`
      } else {
        htmlDom.style.fontSize = fontSize + `px`
      }
    } catch (e) {
      console.error(e)
    }
  }

  flex()
  window.addEventListener('resize', flex)
})()

// 使用HMR
if (process.env.NODE_ENV !== 'production') {
  if (module.hot) {
    module.hot.accept()
  }
}

function render(props){
    ReactDOM.render(
      <App />,
      props && props.container ? props.container.querySelector('#react-body') : document.getElementById('react-body')
    )
}

// if (!process.env.isAdminPortal) {
if (!window.__POWERED_BY_QIANKUN__) {
  render()
}

/**
 * bootstrap 只会在微应用初始化的时候调用一次，下次微应用重新进入时会直接调用 mount 钩子，不会再重复触发 bootstrap。
 * 通常我们可以在这里做一些全局变量的初始化，比如不会在 unmount 阶段被销毁的应用级别的缓存等。
 */
async function bootstrap() {
  console.log('react app bootstraped')
}

/**
 * 应用每次进入都会调用 mount 方法，通常我们在这里触发应用的渲染方法
 */
async function mount(props) {
  console.log(props)
  console.log(window.cloudbase)
  render(props)
}

/**
 * 应用每次切出/卸载 会调用的方法，通常在这里我们会卸载微应用的应用实例
 */
async function unmount(props) {
  console.log('unmount')
  ReactDOM.unmountComponentAtNode(
    props.container ? props.container.querySelector('#react-body') : document.getElementById('react-body')
  )
}

<% if(adminPortalKey){ %>
((global) => {
  global['<%= adminPortalKey %>'] = {
    bootstrap,
    mount,
    unmount,
  };
})(window);
<% } %>
