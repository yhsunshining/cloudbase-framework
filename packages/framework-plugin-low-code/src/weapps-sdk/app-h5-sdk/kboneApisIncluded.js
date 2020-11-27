// # expose wx api
const kboneApisIncluded = [
  'ismp',
  // 对应wx.api的位置注释
  /**
   * 基础
   */
  // 获取设备信息
  'getSystemInfo',
  'onAppShow',
  'onAppHide',
  'onError',
  'onPageNotFound',
  'onUnhandledRejection',
  'getLaunchOptionsSync',
  /**
   * 数据存储
   */
  'setStorageSync',
  'setStorage',
  'removeStorageSync',
  'removeStorage',
  'getStorageSync',
  'getStorage',
  'getStorageInfoSync',
  'getStorageInfo',
  'clearStorageSync',
  'clearStorage',
  /**
   * 媒体
   */
  /* 图片 */
  'chooseImage', // 图片选择
  'compressImage', // 图片压缩
  'previewImage', // 图片预览
  'saveImageToPhotosAlbum', // 保存图片到相册
  'chooseVideo',
  'chooseMedia',
  'compressVideo',
  'saveVideoToPhotosAlbum',
  'getVideoInfo',
  /**
   * 位置
   */
  'stopLocationUpdate',
  'startLocationUpdateBackground',
  'startLocationUpdate',
  'openLocation',
  'onLocationChange',
  'offLocationChange',
  'getLocation',
  'chooseLocation',
  /**
   * 路由
   */
  'reLaunch',
  'redirectTo',
  'navigateTo',
  'navigateBack',
  /**
   * 界面
   */
  /* 交互 */
  'showModal', // 对话框
  'showToast',
  'hideToast',
  'showLoading',
  'hideLoading',
  'showActionSheet',
  'hideHomeButton',
  'onPullDownRefresh',
  'offPullDownRefresh',
  'startPullDownRefresh',
  'stopPullDownRefresh',
  'pageScrollTo',
  'nextTick',
  /* 导航栏 */
  'showNavigationBarLoading',
  'setNavigationBarTitle',
  'setNavigationBarColor',
  'hideNavigationBarLoading',
  'hideHomeButton',
  /* 背景 */
  'setBackgroundTextStyle',
  'setBackgroundColor',
  /* Tab Bar */
  'showTabBarRedDot',
  'showTabBar',
  'setTabBarStyle',
  'setTabBarItem',
  'setTabBarBadge',
  'removeTabBarBadge',
  'hideTabBarRedDot',
  'hideTabBar',
  /**
   * 网络
   */
  'uploadFile',
  'downloadFile',
  /**
   * 开放接口
   */
  'getSetting',
  'openSetting',
  'authorize',
  /**
   * 设备
   */
  'makePhoneCall',
  'scanCode',
  'vibrateShort',
  'vibrateLong',
  /**
   * WXML
   */
  'createSelectorQuery'
]

export default kboneApisIncluded;
