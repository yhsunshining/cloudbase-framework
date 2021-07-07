import { ICompositedComponent } from './material';

export interface IPlugin {
  title: string;
  name: string;
  module: string;
  type?: 'kbone' | 'mp';
  version: string;
}

export interface IMiniprogramPlugin {
  name: string;
  version: string;
  pluginAppId: string;
  componentConfigs: (ICompositedComponent & {
    isMiniProgramPlugins?: boolean;
  })[];
}
