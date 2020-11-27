// 处理url链接，加入params参数
export function urlJoinParams(url, params) {
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
