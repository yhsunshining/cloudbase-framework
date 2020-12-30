import { CSSProperties, ICommonStyle } from './style'
import { ActionType } from './action'
import { IWeAppCode } from './lowcode'
import { IPlugin } from '../types/plugins'
import { IDataBind } from './web'
import { HISTORY_TYPE } from '../../index'

export interface IAppAndPageVar {
  /** 各种变量 */
  dataset?: {
    state?: {}
    param?: {}
  }
  vars: {
    /** 数据源变量 */
    data: any[]
  }
}
export interface IWeAppData {
  selectedPageId?: string
  historyType?: HISTORY_TYPE
  pageInstanceList: IWeAppPage[]
  lowCodes: IWeAppCode[]
  npmDependencies: { [packageName: string]: string }
  plugins: IPlugin[]
  maxID?: number // used to generate new component keys
  rootPath?: string // Mp subpackage name
  themeVars?: { [key: string]: string }
  presetColors?: string[]
  appConfig?: Record<string, any>
  envId: string // 云开发环境ID
  datasources: any[]
  dataset?: IAppAndPageVar['dataset']
  vars: IAppAndPageVar['vars']
}

export interface IWeAppPage {
  id: string
  isHome: boolean
  data: { [prop: string]: IDynamicValue }
  listeners: IEventListener[]
  componentInstances: { [key: string]: IWeAppComponentInstance }
  pluginInstances: any[]
  // style: React.CSSProperties  // Will override commonStyle
  commonStyle: ICommonStyle
  styleBindPath: string
  lowCodes?: IWeAppCode[]
  children?: IWeAppPage[]
  pageId?: string

  /**
   * @deprecated  moved to lowCodes
   */
  codeType?: 'page' | 'global'
  /**
   * @deprecated moved to lowCodes
   */
  code?: string
}

export interface IWeAppComponentInstance {
  xComponent?: {
    // Empty when it's slot container
    moduleName: string
    name: string
  }
  xProps?: {
    data: { [prop: string]: IDynamicValue }
    directives?: {
      // control properties, https://vuejs.org/v2/guide/syntax.html#Directives, https://developers.weixin.qq.com/miniprogram/dev/reference/wxml/conditional.html,
      waIf?: IDynamicValue
      waFor?: IDynamicValue // TODO
    }
    listeners?: IEventListener[]
    style: CSSProperties //React.CSSProperties, should override common style
    styleBind: IDynamicValue
    classList: string[]
    classListBind: IDynamicValue
    commonStyle: ICommonStyle
    styleBindPath?: string
  }
  xIndex?: number // ordering
  properties?: { [key: string]: IWeAppComponentInstance }
}

export interface IEventListener extends IEventModifiers {
  trigger: string
  type: ActionType // listener defition location
  handler: {
    moduleName: string // namesapce, could be rematch module, material name
    name: string // Handler name or inline code
  }
  data: { [prop: string]: IDynamicValue } // user configured handler params
}

export interface IEventModifiers {
  isCapturePhase?: boolean
  noPropagation?: boolean // stopPropagation
}

export interface IDynamicValue {
  /**
   * computed: values derived from rematch store state by functions
   * rematch: data in rematch store state
   * local: local variables in the render function, e.g. for loop item
   */
  type?: 'static' | PropBindType // default is static
  value: any | string
}

export enum PropBindType {
  state = 'rematch',
  computed = 'computed',
  forItem = 'for-item',
  expression = 'expression',
  prop = 'prop',
  slot = 'slot',
  dataVar = 'dataVar',
  stateData = 'state',
  paramData = 'params',
}

export enum BindPropertyPath {
  style = 'style',
  classNameList = 'classNameList',
}
export interface ILockedPage {
  id: string
  username: string
  socketId: string
}
