export interface IPlugin {
  title: string
  name: string
  module: string
  type?: 'kbone' | 'mp'
  version: string
}
