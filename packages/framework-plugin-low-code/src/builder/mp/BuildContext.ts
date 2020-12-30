import { IMaterialLibs } from './materials'

/**
 * All build parameters and intermediate data to be share across processes
 */
export interface IBuildContext {
  // build params
  appId: string
  projDir: string
  materialLibs: IMaterialLibs
  isProduction: boolean
  isMixMode: boolean
  rootPath?: string
}
