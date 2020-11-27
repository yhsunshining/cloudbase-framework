const __weappsNative = window.__weappsNative
export let preHashPath = '/'
let appConfig = {}
export const setConfig = (config) => {
  if (process.env.isApp) {
    try {
      const { generate = {}, appExtraConfig = {}, __homePath__, app, pages} = config
      let pagePaths = Object.keys(pages)
      // pages添加pagePath，以及样式设置
      const __pages = pagePaths.map(path => {
        return {
          ...pages[path].extra,
          pagePath: `${preHashPath}${[path]}`
        }
      })
      let tabBar = generate.tabBar || appExtraConfig.tabBar || {}
      const { list = []} = tabBar
      tabBar.list = list.map(item => {
        let pagePath = item.pagePath
        let result = /pages\/([0-9a-zA-z_]+)\/index/.exec(pagePath)
        if (result.length > 1) {
          pagePath = `${preHashPath}${result[1]}`
        }
        return {
          ...item,
          pagePath
        }
      })
      let data = {
        home: preHashPath + __homePath__,
        window: app,
        pages: __pages,
        tabBar
      }
      const params = {
        data
      }
      appConfig = data;
      console.log(`__weappsNative.setConfig 开始执行...`, JSON.stringify(params))
      __weappsNative && __weappsNative.setConfig(JSON.stringify(params))
    } catch(e) {
      console.log(e)
    }
  }
}
export const getConfig = () => {
  return appConfig
}
