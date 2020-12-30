import { IMaterialItem } from '../../weapps-core'

/**
 * All build parameters and intermediate data to be share across processes
 */
export interface IBuildContext {
  // build params
  appId: string
  projDir: string
  materialLibs: IMaterialItem[]
  isProduction: boolean
  isMixMode: boolean
  rootPath?: string
}
