import dataSourceProfiles from './datasource-profiles'
import datasetProfiles from './dataset-profiles'

/**
 * 数据源基本配置
 */
export default {
  /** 当前是否处于正式发布模式 */
  isProd: <%= isProd %>,
  /** 低码应用ID */
  appID: '<%= appID %>',
  /** 云开发环境ID */
  envID: '<%= envID %>',
  /** 数据源描述对象数组 */
  dataSourceProfiles: dataSourceProfiles,
  /**
   * 新的dataset变量配置对象
   *  key 为页面ID(全局为$global), val 为变量配置数组
   */
  datasetProfiles: datasetProfiles,
}
