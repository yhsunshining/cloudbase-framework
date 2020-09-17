import { urlJoinParams } from '@govcloud/weapps-sdk'
import { getConfig, preHashPath } from '../setConfig'
import { useHistory } from "react-router-dom";
function routerGo(path, action = 'push') {
   if (process.env.isApp) {
    location.hash = path
   } else {
    const history = useHistory();
    history[action](path);
   }
}

export function navigateTo({ pageId, packageName, params, events, success, fail, complete }) {
  let url = packageName ? `${packageName}_${pageId}` : `${pageId}`
  if (!process.env.isApp) {
    let path = urlJoinParams(url, params)
    routerGo(path, 'push')
  } else {
    const { tabBar = {} } = getConfig()
    const { list } = tabBar
    let isInTabBar = false
    list.forEach(item => {
      let pagePath = item.pagePath.replace(preHashPath, '')
      if (url === pagePath) {
        console.warn(`${url} 已设置在tabBar里 不可跳转`)
        isInTabBar = true
      }
    });
    if (isInTabBar) {
      return
    }
    console.warn(`${url} 不在tabBar里，可以跳转...`)
    let path = urlJoinParams(url, params)
    routerGo(path)
  }
 
}

export function reLaunch({ pageId, packageName, params, events, success, fail, complete }) {
  let url = packageName ? `${packageName}_${pageId}` : `${pageId}`
  let path = urlJoinParams(url, params)
  routerGo(path, 'replace')
}

export function switchTab({ url }) {
  const paths = url.split('?')
  let hash = paths[0]
  let result = /pages\/([0-9a-zA-z_]+)\/index/.exec(url)
  if (result.length > 1) {
    hash = `${result[1]}`
  }
  if (!process.env.isApp) {
    routerGo(`${hash}${paths[1] ? `?${paths[1]}` : ''}`, )
  } else {
    const { tabBar = {} } = getConfig()
    const { list } = tabBar
    let isInTabBar = false
    list.forEach(item => {
      let pagePath = item.pagePath.replace(preHashPath, '')
      if (hash === pagePath) {
        isInTabBar = true
      }
    });
    if (isInTabBar) {
      console.log(`switchTab ${url} 已设置在tabBar里`)
      routerGo(`${hash}${paths[1] ? `?${paths[1]}` : ''}`)
    }
  }
  
}