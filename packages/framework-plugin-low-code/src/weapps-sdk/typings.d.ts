import '@types/weixin-app'
declare global {
  // eslint-disable-next-line @typescript-eslint/interface-name-prefix
  interface Window {
    isWeApps: boolean
    weAppsParams: string
    weAppsScene: number
    weAppsSelectedPageId: string
    weAppsHomePageId: string

    $$global: Record<string, any>
    $$subscribe: (event: string, handler: Function) => void
    $$unsubscribe: (event: string, handler?: Function) => void
    $$publish: (event: string, data: any) => void
  }
}
