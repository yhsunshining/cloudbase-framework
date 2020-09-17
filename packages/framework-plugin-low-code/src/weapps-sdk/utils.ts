import * as kbone from 'kbone-api'

// 处理url链接，加入params参数
export function urlJoinParams(url: string, params: any) {
  if (!url || !params || typeof params !== 'object') {
    return url
  }
  const separate = url.indexOf('?') === -1 ? '?' : '&'
  const tempStr = Object.keys(params)
    .map(key => {
      if (typeof params[key] === 'object') {
        params[key] = JSON.stringify(params[key])
      }
      if (params[key] !== undefined) {
        return `${key}=${params[key]}`
      }
      return ''
    })
    .filter(value => value)
    .join('&')
  return `${url}${separate}${tempStr}`
}

// navigateBack
export function navigateBack(delta: number) {
  return new Promise(resolve => {
    const startDelta = getCurrentPages().length - delta
    kbone.navigateBack({
      delta,
      success: () => {
        const checkSuccess = () => {
          setTimeout(() => {
            const currentPageLength = getCurrentPages().length
            if (startDelta === currentPageLength || currentPageLength <= 1) {
              console.log('已回退到指定页面：', getCurrentPages())
              resolve()
            } else {
              checkSuccess()
            }
          }, 100)
        }
        checkSuccess()
      },
    })
  })
}

// 生成唯一的 GUID
export function generateGUID() {
  let text = ''
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  for (let i = 0; i < 10; i += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}
