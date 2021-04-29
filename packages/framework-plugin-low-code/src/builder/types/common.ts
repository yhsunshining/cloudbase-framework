import { IComponentMeta, ICompositedComponent } from 'src/weapps-core';

export const enum BuildType {
  PC = 'pc',
  WEB = 'web',
  MP = 'mp',
  APP = 'app',
  WECHAT_H5 = 'wxH5',
  WECHAT_WORK_H5 = 'qywxH5',
}

export const enum GenerateMpType {
  APP = 'app',
  SUBPACKAGE = 'subpackage',
}

export const enum WebpackModeType {
  NONE = '',
  PRODUCTION = 'production',
}
export type WebpackBuildCallBack = (
  err: any,
  result?: { outDir: string; timeElapsed: number; plugins?: any[] }
) => Promise<void>;

export interface IPackageJson {
  name: string;
  version: string;
  title?: string;
  desc?: string;
  dependencies: {
    [name: string]: string;
  };
  repository: {
    type: string;
    url: string;
  };
}

export const buildAsWebByBuildType = (buildTypeList: BuildType[] = []) => {
  return (
    buildTypeList.includes(BuildType.WEB) ||
    buildTypeList.includes(BuildType.PC) ||
    buildTypeList.includes(BuildType.APP) ||
    buildTypeList.includes(BuildType.WECHAT_WORK_H5) ||
    buildTypeList.includes(BuildType.WECHAT_H5)
  );
};

export interface IAppUsedComp {
  rootPath: string;
  usedComps: IUsedComps;
}
export type IUsedComps = { [libName: string]: Set<string> };

export interface ISyncProp {
  changeEvent: string;
  valueFromEvent: string;
}
export type IComponentInputProps = {
  [componentName: string]: {
    [syncName: string]: ISyncProp | ISyncProp[];
  };
};

export type IComponentsInfoMap = {
  [componentSourceKey: string]:
    | ({ meta: IComponentMeta } & { isComposite: false })
    | (ICompositedComponent & { isComposite: true });
};
