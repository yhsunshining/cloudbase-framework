import { IWeAppComponentInstance } from './app';
import { IWeAppCode } from './lowcode';

export interface ICompLibCommonResource {
  theme: {
    variable: string;
    class: string;
  };
  // 公共资源
  class: string;
  const: IWeAppCode; // 组件库公共变量
  tools: IWeAppCode; // 组件库公共方法
  npm: { [key: string]: string }; // 组件库公共npm依赖
}

// Material data structure in database
export interface IMaterialItem {
  compLibCommonResource: ICompLibCommonResource;
  name: string;
  version: string;
  srcZipUrl: string;
  mpPkgUrl: string; // package url containing mp components
  actions: { name: string }[];
  components: ICompositedComponent[];
  isComposite?: boolean;
  /**
   * 是否来源于小程序插件
   */
  isMiniProgramPlugins?: boolean;
  // ToDo more props
  // props specified in {materials-proj}/src/mp/meta.json
  styles?: string[]; // styles to import in the app.wxss
  dependencies?: {}; // npm deps of the lib

  // 基础组件库
  schemaVersion?: string; // 基础组组件库描述版本 3.0.0
  meta?: Record<string, any>;

  //==========Composited compo==========
  componentInstances?: IWeAppComponentInstance[];
}

export interface ICompositedComponent {
  id: number;
  name: string;
  materialName: string;
  componentInstances: { [key: string]: IWeAppComponentInstance };
  compConfig: Record<string, any>;
  dataForm: any;
  evnets?: any[];
  emitEvents: any[];
  listeners: any[];
  lowCodes: IWeAppCode[];
  meta: IComponentMeta;
  npmDependencies: any;
  // materialName:
  //sourceKey: "complex:Simple"
}

export interface IDependencies {
  [key: string]: string;
}

/**
 * Component meta file
 */
export interface IComponentMeta {
  title: string;
  desc?: string;
  category?: string;
  categoryOrder?: number;
  componentOrder?: number;
  /**
   * use syncProps instead
   * @deprecated
   */
  inputProps: {
    [valuePropName: string]: IPropSynConfig;
  };
  syncProps: {
    // Props to hold user input, usually 'value'
    [valuePropName: string]: IPropSynConfig | IPropSynConfig[];
  };
  platforms: {
    mp: {
      tagName?: string; // wxml tag name
      path?: string; // wx mp component definition file path, e.g. @tencent/mycmplib/mycomp/index.js, ./mycomp/index.js
    };
  };
  mustEmptyStyle?: boolean;
}

interface IPropSynConfig {
  // default: change
  changeEvent: string;
  // how to get user input value from change event, default event.detail.value
  valueFromEvent: string;
  // to add mp form-field behavior, https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/behaviors.html#%E5%86%85%E7%BD%AE%20behaviors
  isFormField?: boolean;
}

export interface IGenericComp {
  propName: string;
  title: string;
}

export const COMPONENT_API_PREFIX = 'this.$WEAPPS_COMP';
export const PAGE_API_PREFIX = 'this';

export function getCompositedComponentClass(comp: ICompositedComponent) {
  return `wa-comp-${comp.materialName}-${comp.name}`;
}
