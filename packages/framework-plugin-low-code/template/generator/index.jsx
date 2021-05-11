import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { setConfig } from '@cloudbase/weda-cloud-sdk/dist/h5'
import App from './router'
<% if(!isSandbox){ %>
import './utils/monitor-jssdk.min'
<% } %>
import './lowcode/style.css'
// 引入数据源管理器并进行初始化
import './datasources'
import './utils/initGlobalVar'
// import i18nData from './i18n/index.js'
import { initAppLifeCycle } from './utils/lifecycle'
<% subAppDataList.forEach(subApp => { %>
  import './packages/<%= subApp.rootPath %>/lowcode/style.css'
<% }) %>

<% if(!isSandbox){ %>
import attachFastClick from 'fastclick'
attachFastClick && attachFastClick.attach && attachFastClick.attach(document.body)
<% } %>
import { app } from './app/global-api'
import { createStateDataSourceVar, generateParamsParser, EXTRA_API } from './datasources'


// 初始化应用生命周期
initAppLifeCycle(app,{
  beforeCustomLaunch: (query)=>{
    EXTRA_API.setParams('$global', query || {})
    createStateDataSourceVar('$global',generateParamsParser({app}))
  }
})
console.log('%c请注意，此应用是通过wa v3构建出来，v3 与 v2 有存在不兼容的情况，请参考迁移文档：https://docs.qq.com/doc/DRmRvT3JpdFB6WGJZ 。', 'color: #f00; font-size: 18px;')

<% if(!isSandbox && isBuildApp){ %>
// app 中注册配置页面以及app的全局配置miniprogram.config，h5里分app以及web页分别处理，使用process.env.isApp 区分判断
import { initWebConfig } from './utils/lifecycle'
import AppConfig from '../webpack/miniprogram.config'
initWebConfig(app, AppConfig);
<% } %>
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


<% if(!isSandbox){ %>
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
<% } %>

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
ReactDOM.render(<App/>, document.getElementById('root'))

<% if(!isSandbox){ %>
// 使用HMR
if(process.env.compileTool === 'vite') {
  if (import.meta.hot) {
    import.meta.hot.accept()
  }
} else {
  if (process.env.NODE_ENV !== 'production') {
    if (module.hot) {
      module.hot.accept()
    }
  }
}
<% } %>