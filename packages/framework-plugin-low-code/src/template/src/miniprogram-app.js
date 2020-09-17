// 兼容 iOS 10，兼容 2.7.0 微信基础库
const entries = require('object.entries')
Object.entries = Object.entries || entries
require("regenerator-runtime");

// ToDo make it configurable
const WxReportV2 = require('./libraries/default-lib/wx_yypt_report_v2.js');

const wxReport = new WxReportV2({
  appKey: '<%= yyptAppKey %>', // 填入你申请的运营平台的应用key(必填)
  reportUrl: '<%= reportUrl %><%= yyptAppKey %>', // 上报url（把后端上报接口需要先挂网关，该url填写网关地址）
  autoReportPV: true, // 是否自动上报页面PV
  // getRemoteParamsUrl获取远程参数url，主要用于获取intervalTime、reportLogsNum和stopReport参数，
  // 返回格式{stopReport:true,intervalTime:3,reportLogsNum:5}
  getRemoteParamsUrl: '',
  stopReport: <%= stopReport %>, // 停止上报
  intervalTime: 3, // 间隔多久执行一次上报，默认3秒
  reportLogsNum: 5, // 每次合并上报记录条数，默认5次
});
import './index.less'

App({
  onLaunch(options) {
    this.yyptReport = wxReport
  },
  onShow(options) {
    console.log('App.onShow --> ', options)
    const pages = getCurrentPages() || []
    const currentPage = pages[pages.length - 1]
    if (currentPage) {
      console.log('currentPage --> ', currentPage.pageId)
    }
    this.yyptReport.startReport()
  },
  onHide() {
    console.log('App.onHide --> ')
    const pages = getCurrentPages() || []
    const currentPage = pages[pages.length - 1]
    if (currentPage) {
      console.log('currentPage --> ', currentPage.pageId)
    }
  },
  onError(err) {
    console.log('App.onError --> ', err)
  },
  onPageNotFound(options) {
    console.log('App.onPageNotFound --> ', options)
  }
})
