import { ActionTrigger, ActionType } from './action'
import { ICommonStyle } from './style'
import { ISchema } from '@formily/react-schema-renderer/lib/types'
import { IWeAppCode } from './lowcode'
import { IPlugin } from './plugins'
import { PropBindType } from './app'

export interface IWebRuntimeAppData {
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
  appConfig?: Record<string, any>
}

export interface IPageInstance extends ICommonInstanceProps {
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

export interface IListenerInstance extends IItemInstance {
  trigger: ActionTrigger
  target?: string | null
  type: ActionType
  handler: {
    moduleName: string // namesapce, could be rematch module, material name
    name: string // Handler name
  }
}

export interface IComponentSchemaJson extends ISchema {
  key?: string
  path?: string
  ['x-props']?: IComponentInstanceProps
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
