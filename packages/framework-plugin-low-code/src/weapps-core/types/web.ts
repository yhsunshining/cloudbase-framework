import { ActionType } from './action'
import { ICommonStyle } from './style'
import { IWeAppCode } from './lowcode'
import { IPlugin } from './plugins'
import { PropBindType, IEventModifiers, IEventListener, IAppAndPageVar } from './app'


export interface IWebRuntimeAppData extends IAppAndPageVar {
  /**
   * 云开发环境envId
   */
  envId?: string
  /**
   * 数据源
   */
  datasources: any[]

  selectedPageId?: string
  pageInstanceList: IPageInstance[]
  rootPath?: string
  maxID?: number // used to generate new component keys
  codeModules: IWeAppCode[]
  /**
   * The dependency in package.json of generated app
   */
  npmDependencies: { [packageName: string]: string }
  // 插件
  plugins?: IPlugin[]
  themeVars?: { [key: string]: string }
  presetColors?: string[] // 预置颜色列表
  appConfig?: { [key: string]: any }
}

export interface IPageInstance extends ICommonInstanceProps, IAppAndPageVar {
  id: string
  isHome?: boolean
  // hasPage: boolean;
  // hasStore: boolean;
  componentSchemaJson?: IComponentSchemaJson
  pluginInstances: IPluginInstance[]
  children?: IPageInstance[]
  codeModules: IWeAppCode[]
}

export interface IPageData {
  title: string
  desc?: string
}

export interface IDataBind {
  propertyPath: string
  bindDataPath: string
  type?: PropBindType // default state
}

export interface IDataType {
  propertyPath: string
  type?: 'static' | 'slot' | 'bind'
}

export interface IDataAndBindInstanceProps {
  data: { [key: string]: any }
  dataBinds?: IDataBind[]
  dataTypes?: IDataType[]
}

export interface IItemInstance extends IDataAndBindInstanceProps {
  key: Readonly<string>
  sourceKey: string
  instanceFunction?: string
}

export interface IPluginInstance extends IItemInstance {
  instanceFunction?: string
}

export interface IListenerInstance extends IItemInstance, IEventModifiers {
  trigger: string
  target?: string | null
  type: ActionType
  handler: {
    moduleName: string // namesapce, could be rematch module, material name
    name: string // Handler name
  }
}

export interface IComponentSchemaJson {
  key?: string
  type?: string
  ['x-component']?: string
  ['x-props']?: IComponentInstanceProps
  ['x-index']?: number
  properties: { [key: string]: IComponentSchemaJson }
  path?: string // findComponentInTree 时动态加入
}

export interface ICommonInstanceProps extends IDataAndBindInstanceProps {
  style: object
  commonStyle?: ICommonStyle
  styleBindPath?: string
  styleBind?: IDataBind
  classNameListBind?: IDataBind
  classNameList?: string[]
  listenerInstances: IListenerInstance[]
}

export interface IComponentInstanceProps extends ICommonInstanceProps {
  sourceKey: string
  isContainer: boolean
}

export interface IPageWidgets {
  style: Record<string, any>
  classList: string[]
  value?: any
  [key: string]: any
}
