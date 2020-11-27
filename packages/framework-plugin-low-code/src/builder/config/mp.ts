/**
 * The prefixes of variables used in wxml
 */
export function getWxmlDataPrefix(debug = false) {
  return !debug
    ? {
      appState: 'g',
      pageState: 'p',
      appComputed: 't',
      pageComputed: 'c',
      widgetProp: '',
      forItem: 'f',
      forIndex: 'i',
    }
    : {
      appState: 'appState',
      pageState: 'pageState',
      appComputed: 'appComputed',
      pageComputed: 'pageComputed',
      widgetProp: '',
      forItem: 'forItem_',
      forIndex: 'forIndex_',
    }
}

// variable separator in wxml attribute
export const varSeparator = '.'

/**
 * If the prop name of component is textContentPropName, this prop will be generated as child(innerText) of the component
 */
export const textContentPropName = 'text'

export const jsonSchemaType2jsClass = {
  number: 'Number',
  string: 'String',
  image: 'String',
  color: 'String',
  boolean: 'Boolean',
  object: 'Object',
  array: 'Array',
  time: 'String',
  date: 'String',
}

export const defaultProjConfig = {
  packOptions: {
    ignore: [],
  },
  setting: {
    urlCheck: false,
    es6: true,
    enhance: true,
    postcss: true,
    minified: true,
    newFeature: true,
    nodeModules: true,
    autoAudits: false,
    uglifyFileName: false,
    checkInvalidKey: true,
    checkSiteMap: true,
    uploadWithSourceMap: true,
  },
  compileType: 'miniprogram',
  libVersion: '2.11.2',
  appid: 'touristappid',
  debugOptions: {},
  isGameTourist: false,
  simulatorType: 'wechat',
  simulatorPluginLibVersion: {},
}

// Builtin events defined by WX, https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxml/event.html
export const builtinMpEvents = [
  'touchstart', //	手指触摸动作开始
  'touchmove', //		手指触摸后移动
  'touchcancel', //		手指触摸动作被打断，如来电提醒，弹窗
  'touchend', //		手指触摸动作结束
  'tap', //		手指触摸后马上离开
  'longpress', //		手指触摸后，超过350ms再离开，如果指定了事件回调函数并触发了这个事件，tap事件将不被触发	1.5.0
  'longtap', //		手指触摸后，超过350ms再离开（推荐使用longpress事件代替）
  'transitionend', //		会在 WXSS transition 或 wx.createAnimation 动画结束后触发
  'animationstart', //		会在一个 WXSS animation 动画开始时触发
  'animationiteration', //		会在一个 WXSS animation 一次迭代结束时触发
  'animationend', //		会在一个 WXSS animation 动画完成时触发
  'touchforcechange', // 在支持 3D Touch 的 iPhone 设备，重按时会触发
]

export const builtinMpTags = 'cover-image,cover-view,match-media-movable-area,movable-view,scroll-view,swiper,swiper-item,view,\
icon,progress,rich-text,text,\
button,checkbox,checkbox-group,editor,form,input,label,picker,picker-view,picker-view-column,radio,radio-group,slider,switch,textarea,\
functional-page-navigator,navigator,\
audio,camera,image,live-player,live-pusher,video,voip-room,map,canvas,\
ad,ad-custom,official-account,open-data,web-view'.split(
  ','
)

export const builtinWigetProps = 'id,style,classList,className,parent,children,widgetType,getWidgetsByType'.split(
  ','
)

export function isBuiltinMpTag(tag: string) {
  return builtinMpTags.indexOf(tag) > -1
}

export function getClassAttrName(tag: string) {
  return isBuiltinMpTag(tag) ? 'class' : 'className'
}
