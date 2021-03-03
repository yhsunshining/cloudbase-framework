'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.sendRequest = exports.isSuccessStatusCode = void 0
const request_1 = __importDefault(require('request'))
const json_transform_1 = require('./json-transform')
function mergeFields(fields, fields1) {
  // one of them is empty
  if (!fields !== !fields1) return fields || fields1
  // both are empty, return empty
  if (!fields) return fields
  return Object.assign({}, fields, fields1)
}
/**
 * 解析URL地址
 *  这里不使用node的 url.resolve, 因为会与用户预期不一致 url.resolve('http://example.com/one', '/two');    // 'http://example.com/two'
 * 本算法采取字符串拼接方式来解析URL, 并能移除多余的 / , 也能自动补充缺少的 /
 */
function resolveUrl(baseUrl, url) {
  if (!baseUrl || /^https?\:\/\//i.test(url || '')) return url
  if (!url) return baseUrl
  // 处理路径 / 问题
  const baseUrlEndsWithSlash = baseUrl.lastIndexOf('/') === baseUrl.length - 1
  var urlStartsWithSlash = url.indexOf('/') === 0
  if (baseUrlEndsWithSlash && urlStartsWithSlash) {
    return baseUrl + url.slice(1)
  } else if (baseUrlEndsWithSlash || urlStartsWithSlash) {
    return baseUrl + url
  } else {
    return baseUrl + '/' + url
  }
}
function isSuccessStatusCode(code) {
  return (code >= 200 && code < 300) || code === 304
}
exports.isSuccessStatusCode = isSuccessStatusCode
function hasHeader(headers, headerName) {
  const h = headerName.toLowerCase()
  return Object.keys(headers).some((k) => k.toLowerCase() === h)
}
function sendRequest(ds, methodConfig, context, params, requestCb) {
  const dsConfig = ds.config || {}
  if (methodConfig.type !== 'http')
    throw new Error(
      `method ${methodConfig.name} not a valid http datasource method`
    )
  const fieldParams = { params, env: context.envInfo }
  const httpConfig = methodConfig.calleeBody
  // transform param placeholders in url
  const requestUrl = json_transform_1.transformJSONWithTemplate(
    fieldParams,
    resolveUrl(dsConfig.baseUrl, httpConfig.url)
  )
  if (!/^https?:\/\//i.test(requestUrl)) throw new Error('invalid request url')
  const requestMethod = httpConfig.method.toUpperCase()
  const requestConfig = {
    uri: requestUrl,
    method: requestMethod,
    headers: {},
  }
  if (dsConfig.header || (httpConfig.header && httpConfig.header.values)) {
    const headerFields = mergeFields(dsConfig.header, httpConfig.header.values)
    requestConfig.headers =
      json_transform_1.transformJSONWithTemplate(fieldParams, headerFields) ||
      {}
  }
  // set referer to avoid referer check
  if (!hasHeader(requestConfig.headers, 'Referer')) {
    requestConfig.headers['Referer'] = requestUrl
  }
  if (!hasHeader(requestConfig.headers, 'User-Agent')) {
    requestConfig.headers['User-Agent'] = 'CloudBaseLowCode/2.0'
  }
  // suggest server respond with a json string
  if (!hasHeader(requestConfig.headers, 'Accept')) {
    requestConfig.headers['Accept'] =
      'application/json, text/javascript, */*; q=0.01'
  }
  if (
    ['POST', 'PUT', 'PATCH'].includes(requestMethod) &&
    httpConfig.body &&
    httpConfig.body.values
  ) {
    const body = json_transform_1.transformJSONWithTemplate(
      fieldParams,
      httpConfig.body.values
    )
    switch (httpConfig.body.contentType) {
      case 'form':
        requestConfig.form = body
        break
      case 'json':
        requestConfig.body = body
        requestConfig.headers['Content-Type'] =
          'application/json; charset=UTF-8'
        break
      case 'xml':
        requestConfig.body = String(body)
        requestConfig.headers['Content-Type'] = 'application/xml;charset=UTF-8'
        break
      case 'raw':
      default:
        requestConfig.body = String(body)
    }
  }
  if (httpConfig.query && httpConfig.query.values) {
    const query = json_transform_1.transformJSONWithTemplate(
      fieldParams,
      httpConfig.query.values
    )
    requestConfig.qs = query
  }
  return new Promise((resolve, reject) => {
    request_1.default(requestConfig, (error, response, body) => {
      if (requestCb) {
        requestCb(error, response, body, resolve, reject)
        return
      }
      if (error) {
        return reject(error)
      }
      if (!isSuccessStatusCode(response.statusCode)) {
        return reject(
          new Error(
            `http statusCode ${response.statusCode}, response body ${response.body}`
          )
        )
      }
      const bodyType = typeof body
      if (bodyType === 'object') {
        return resolve(body)
      }
      if (bodyType === 'string') {
        try {
          return resolve(JSON.parse(body))
        } catch (error) {
          return reject(
            new Error(`invalid response body, expect a json string: ${body}`)
          )
        }
      }
      reject(new Error(`unsupported response body type ${bodyType}`))
    })
  })
}
exports.sendRequest = sendRequest
