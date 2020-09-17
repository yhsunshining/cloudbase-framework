import webpack from 'webpack'

export type BuildType = 'web' | 'mp' | 'app' | 'qywxH5' | 'wxH5'
export type GenerateMpType = 'app' | 'subpackage'
export type WebpackModeType = 'production' | ''
export type WebpackBuildCallBack = (err: any, stats: webpack.Stats, options?: any) => Promise<void>

export interface IPackageJson {
  name: string
  version: string
  title?: string
  desc?: string
  dependencies: {
    [name: string]: string
  }
  repository: {
    type: string
    url: string
  }
}

export const buildAsWebByBuildType = (buildTypeList: BuildType[] = []) => {
  return (
    buildTypeList.includes('web') ||
    buildTypeList.includes('app') ||
    buildTypeList.includes('qywxH5') ||
    buildTypeList.includes('wxH5')
  )
}
