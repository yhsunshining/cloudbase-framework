import axios from 'axios'
import { stringify } from 'qs'

const internalRequest = axios.create()

export default function(originParams = {}) {
  const requestConfig = {
    ...originParams,
    headers: {
      ...originParams.header,
    },
  }

  // 针对 x-www-form-urlencoded 类型数据转换
  if (originParams.data && originParams.header) {
    if (originParams.header['Content-Type'] === 'application/x-www-form-urlencoded') {
      requestConfig.data = stringify(originParams.data)
    }
  }

  return internalRequest
    .request(requestConfig)
    .then(res => {
      // request 保持与小程序一致
      res.statusCode = res.status
      delete res.status
      res.header = res.headers
      delete res.headers
      originParams.success && originParams.success(res)
      originParams.complete && originParams.complete(res)
      return res
    })
    .catch(err => {
      originParams.fail && originParams.fail(err)
      originParams.complete && originParams.complete(res)
      return Promise.reject(err)
    })
}
