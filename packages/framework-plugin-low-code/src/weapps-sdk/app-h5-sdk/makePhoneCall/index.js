import { shouleBeObject, getParameterError } from '../utils'
export default function makePhoneCall (options) {
  // options must be an Object
  const isObject = shouleBeObject(options)
  if (!isObject.res) {
    const res = { errMsg: `makePhoneCall${isObject.msg}` }
    console.error(res.errMsg)
    return Promise.reject(res)
  }

  const { phoneNumber, success, fail, complete } = options
  const res = { errMsg: 'makePhoneCall:ok' }

  if (typeof phoneNumber !== 'string') {
    res.errMsg = getParameterError({
      name: 'makePhoneCall',
      para: 'phoneNumber',
      correct: 'String',
      wrong: phoneNumber
    })
    console.error(res.errMsg)
    typeof fail === 'function' && fail(res)
    typeof complete === 'function' && complete(res)
    return Promise.reject(res)
  }

  window.location.href = `tel:${phoneNumber}`

  typeof success === 'function' && success(res)
  typeof complete === 'function' && complete(res)

  return Promise.resolve(res)
}
