import { setConfig } from '@cloudbase/weda-cloud-sdk'
import lifeCycle from './lowcode/lifecycle'
import { app } from './app/weapps-api'
import WxReportV2 from './common/wx_yypt_report_v2'

// 引入数据源管理器并进行初始化
import { EXTRA_API, createStateDataSourceVar, generateParamsParser } from './datasources/index'

<% if(yyptConfig.yyptAppKey) { %>
const wxReport = new WxReportV2({
    appKey: '<%= yyptConfig.yyptAppKey %>', // 填入你申请的运营平台的应用key(必填)
    reportUrl: '<%= yyptConfig.reportUrl %><%= yyptConfig.yyptAppKey %>', // 上报url（把后端上报接口需要先挂网关，该url填写网关地址）
    autoReportPV: true, // 是否自动上报页面PV
    // getRemoteParamsUrl获取远程参数url，主要用于获取intervalTime、reportLogsNum和stopReport参数，
    // 返回格式{stopReport:true,intervalTime:3,reportLogsNum:5}
    getRemoteParamsUrl: '',
    stopReport: <%= yyptConfig.stopReport %>, // 停止上报
    intervalTime: 3, // 间隔多久执行一次上报，默认3秒
    reportLogsNum: 5, // 每次合并上报记录条数，默认5次
});

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

<% }%>
App({
  onLaunch(options) {
    this.app = app
    const onLaunch = lifeCycle.onLaunch || lifeCycle.onAppLaunch
    let { query={} } = options
    EXTRA_API.setParams('$global', query )
    createStateDataSourceVar('$global', generateParamsParser({app}))

    onLaunch && onLaunch.call(this, options)
    <% if(yyptConfig.yyptAppKey) { %>
    // 挂运营平台上报对象到app里
    app.yyptReport = wxReport
    <% }%>
  },
  onShow(options) {
    const fn = lifeCycle.onShow || lifeCycle.onAppShow
    fn && fn.call(this, options)
    <% if(yyptConfig.yyptAppKey) { %>
    wxReport.startReport()
    <% }%>
  },
  onHide() {
    const fn = lifeCycle.onHide || lifeCycle.onAppHide
    fn && fn.call(this)
  },
  onError(msg) {
    const fn = lifeCycle.onError || lifeCycle.onAppError
    fn && fn.call(this, msg)
  },
  onPageNotFound() {
    const fn = lifeCycle.onPageNotFound
    fn && fn.call(this)
  },
  onUnhandledRejection() {
    const fn = lifeCycle.onUnhandledRejection
    fn && fn.call(this)
  },
})
