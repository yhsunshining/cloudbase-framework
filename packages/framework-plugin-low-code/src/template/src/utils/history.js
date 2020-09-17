let history

function removeS(path) {
  if (path && path[0] === '/') {
    return path.slice(1)
  }
  return path
}

if (!process.env.isMiniprogram) {
  const createHashHistory = require("history").createHashHistory
  history = createHashHistory({
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

export {
  history
}
