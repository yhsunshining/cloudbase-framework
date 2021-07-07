import {
  IMaterialItem,
  IWeAppData,
  IMiniprogramPlugin,
} from '../../weapps-core';

/**
 * All build parameters and intermediate data to be share across processes
 */
export interface IBuildContext {
  // build params
  appId: string;
  projDir: string;
  materialLibs: IMaterialItem[];
  isProduction: boolean; // production build
  mainAppData: IWeAppData;
  isMixMode: boolean;
  rootPath?: string;
  miniprogramPlugins?: IMiniprogramPlugin[];
}
