import * as path from 'path'
import * as os from 'os'
export * from './common'

export const appTemplateDir = path.resolve(__dirname, '../../../template')
export const npmRegistry = 'https://mirrors.tencent.com/npm/'
export const materialsDirName = 'materials' // materials diretory of current project
export const sharedMaterialsDir = path.join(os.homedir(), '.weapps-materials')

// Config for pxToRem
export const remConfig = {
  rootValue: 28,
  propList: ['*'],
  unitPrecision: 5,
  selectorBlackList: [],
  replace: true,
  mediaQuery: false,
  minPixelValue: 0,
}

export const rpxConfig = {
  zoom: 1,
}
