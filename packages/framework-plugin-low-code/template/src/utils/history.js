const { createHashHistory, createBrowserHistory } = require('history')

let history

function removeS(path) {
  if (path && path[0] === '/') {
    return path.slice(1)
  }
  return path
}

if (!process.env.isMiniprogram) {
  const createHistory =
    process.env.buildType === 'app' || process.env.historyType === 'HASH'
      ? createHashHistory
      : createBrowserHistory
  history = createHistory({
    basename: '', // The base URL of the app (see below)
    forceRefresh: false, // Set true to force full page refreshes
    keyLength: 6, // The length of location.key
  })
} else {
  history = {
    push(path) {
      wx.navigateTo({
        url: '/pages/' + removeS(path) + '/index'
      })
    },
    replace(path) {
      wx.redirectTo({
        url: '/pages/' + removeS(path) + '/index'
      })
    },
    reLaunch(path) {
      wx.reLaunch({
        url: '/pages/' + removeS(path) + '/index'
      })
    },
    navigateBack(delta = 1) {
      wx.navigateBack({
        delta
      })
    }
  }
}

function generateBrowserHistory(param) {
  history = createBrowserHistory(param)
  return history
}

function generateHashHistory(param) {
  history = createHashHistory(param)
  return history
}

export { history, generateBrowserHistory, generateHashHistory }
