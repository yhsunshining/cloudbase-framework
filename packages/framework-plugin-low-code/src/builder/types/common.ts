import webpack from 'webpack'

export const enum BuildType {
  WEB = 'web',
  MP = 'mp',
  APP = 'app',
  WECHAT_H5 = 'wxH5',
  WECHAT_WORK_H5 = 'qywxH5',
}

export const enum GenerateMpType {
  APP = 'app',
  SUBPACKAGE = 'subpackage'
}

export const enum WebpackModeType {
  NONE = '',
  PRODUCTION = 'production'
}
export type WebpackBuildCallBack = (
  err: any,
  result?: { outDir: string; timeElapsed: number; plugins?: any[] }
) => Promise<void>

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
    buildTypeList.includes(BuildType.WEB) ||
    buildTypeList.includes(BuildType.APP) ||
    buildTypeList.includes(BuildType.WECHAT_WORK_H5) ||
    buildTypeList.includes(BuildType.WECHAT_H5)
  )
}

export type IComponentInputProps = Record<
  string,
  Record<
    string,
    {
      changeEvent: string
      valueFromEvent: string
    }
  >
>
