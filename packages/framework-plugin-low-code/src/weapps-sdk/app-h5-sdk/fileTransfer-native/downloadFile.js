
import { createLoadTask } from './common'

const apiName = 'downloadFile'
const taskApiName = 'downloadTask'

/**
 * 下载文件资源到本地。客户端直接发起一个 HTTPS GET 请求，返回文件的本地临时路径。使用前请注意阅读相关说明。
 * 注意：请在服务端响应的 header 中指定合理的 Content-Type 字段，以保证客户端正确处理文件类型。
 * @param {Object} object 参数
 * @param {string} object.url 下载资源的 url
 * @param {Object} [object.header] HTTP 请求的 Header，Header 中不能设置 Referer
 * @param {Object} [object.timeout] 超时时间，单位为毫秒
 * @param {string} [object.filePath] *指定文件下载后存储的路径
 * @param {function} [object.success] 接口调用成功的回调函数
 * @param {function} [object.fail] 接口调用失败的回调函数
 * @param {function} [object.complete] 接口调用结束的回调函数（调用成功、失败都会执行）
 * @returns {DownloadTask}
 */
const downloadFile = ({ url, filePath, header, timeout, success, fail, complete }) => {
  let task = {}
  const promise = new Promise((resolve, reject) => {
    task = createLoadTask(apiName, taskApiName, {
      url,
      header,
      timeout,
      filePath,
      success: res => {
        success && success(res)
        complete && complete()
        resolve(res)
      },
      error: res => {
        fail && fail(res)
        complete && complete()
        reject(res)
      },
    })
  })
  return Object.assign(promise, task)
}

export default downloadFile