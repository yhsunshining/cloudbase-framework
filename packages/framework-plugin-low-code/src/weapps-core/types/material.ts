import { IWeAppComponentInstance } from './app'
import { IWeAppCode } from './lowcode'

// Material data structure in database
export interface IMaterialItem {
  name: string
  version: string
  srcZipUrl: string
  mpPkgUrl: string // package url containing mp components
  actions: { name: string }[]
  components: ({ name: string } | ICompositedComponent)[]
  isComposite?: boolean
  // ToDo more props
  //==========Composited compo==========
  componentInstances?: IWeAppComponentInstance[]
}

export interface ICompositedComponent {
  id: number
  name: string
  materialName: string
  componentInstances: { [key: string]: IWeAppComponentInstance }
  dataForm: any
  emitEvents: any[]
  listeners: any[]
  lowCodes: IWeAppCode[]
  meta: IComponentMeta
  npmDependencies: any
  // materialName:
  //sourceKey: "complex:Simple"
}

export interface IDependencies {
  [key: string]: string
}


/**
 * Component meta file
 */
export interface IComponentMeta {
  title: string
  desc?: string
  category?: string
  categoryOrder?: number
  componentOrder?: number
  // Props to hold user input, usually 'value'
  inputProps: {
    [valuePropName: string]: {
      // default: change
      changeEvent: string
      // how to get user input value from change event, default event.detail.value
      valueFromEvent: string
    }
  }
  platforms: {
    mp: {
      tagName?: string // wxml tag name
      path?: string // wx mp component definition file path, e.g. @tencent/mycmplib/mycomp/index.js, ./mycomp/index.js
    }
  }
  mustEmptyStyle?: boolean
}

/**
 * Generated material lib meta file for mp
 *
 * Parsed materials info
 */
export interface IMaterialLibMeta {
  name: string
  title: string
  version: string
  desc: string
  styles: string[] // styles to import in the app.wxss
  dependencies: {} // npm deps of the lib
  isComposite: boolean
  components: { [componentName: string]: IComponentMeta }
}

export const compositedComponentApi = 'this.$WEAPPS_COMP'

export function getCompositedComponentClass(comp: ICompositedComponent) {
  return `wa-comp-${comp.materialName}-${comp.name}`
}