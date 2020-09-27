interface IConfig {
  service: {
    domain: string
    appId?: string // service app id
    getLoginUrl(wxCode: string): string // no domain
    headers: Record<string, any>
  }
  needReLoginErrorCode: number[]
  ignoreErrorCode: number[]

  storageKeyOpenId: string
  storageKeySessionId: string
  sessionIdHeader: string
  sessionIdName: string
}

const defaultConfig = {
  sessionIdHeader: 'sessionid',
  sessionIdName: 'code',

  storageKeyOpenId: 'wx-openid',
  storageKeySessionId: 'wx-sessionid',
  ignoreErrorCode: [],
  needReLoginErrorCode: [],
}

const globalName = 'weapps-sdk__config'
export function getConfig() {
  return window.$$global[globalName] as IConfig
}
export function configure(userConfig: Partial<IConfig>) {
  window.$$global[globalName] = { ...defaultConfig, ...userConfig } as IConfig
}
