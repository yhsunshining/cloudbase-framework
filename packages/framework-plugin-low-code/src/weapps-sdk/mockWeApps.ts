import * as querystring from 'querystring'
// 覆写 getLaunchOptionsSync
export function getLaunchOptions() {
  if (window.isWeApps) {
    return {
      scene: window.weAppsScene,
      path: `pages/${window.weAppsHomePageId}/index`,
      query: parseQuery(window.weAppsParams[window.weAppsHomePageId]),
    }
  }

  return (wx as any).getLaunchOptionsSync()
}

// 获取当前页面
export function getPageOptions() {
  if (window.isWeApps) {
    return parseQuery(window.weAppsParams[window.weAppsSelectedPageId])
  }
  // 小程序中取到query
  if (process.env.isMiniprogram) {
    try {
      const currentPage = getCurrentPages().slice(-1)[0] as any
      return currentPage.query || currentPage.options
    } catch (e) {
      console.error(e)
    }
  } else {
    // 小程序之前的h5中取到query
    return location.hash.split('?')[1] ? querystring.parse(location.hash.split('?')[1]) : {}
  }
}

function parseQuery(queryString: string) {
  if (!queryString) return {}

  return queryString.split('&').reduce((query, item) => {
    const [key, value] = item.split('=')
    query[key] = value
    return query
  }, {})
}
