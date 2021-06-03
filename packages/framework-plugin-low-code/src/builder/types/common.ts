export {
  BuildType,
  GenerateMpType,
  WebpackModeType,
  WebpackBuildCallBack,
  IPackageJson,
  buildAsWebByBuildType,
  buildAsAdminPortalByBuildType,
  IAppUsedComp,
  IUsedComps,
  ISyncProp,
  IComponentInputProps,
  IFileCodeMap,
} from '../../generator/types/common';

import { IComponentMeta, ICompositedComponent } from 'src/weapps-core';

export type IComponentsInfoMap = {
  [componentSourceKey: string]:
    | ({ meta: IComponentMeta } & { isComposite: false })
    | (ICompositedComponent & { isComposite: true });
};
