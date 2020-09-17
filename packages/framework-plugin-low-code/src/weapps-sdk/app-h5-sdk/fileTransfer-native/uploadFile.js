import { createLoadTask } from './common'
const apiName = 'uploadFile'
const taskApiName = 'uploadTask'

/**
 * 将本地资源上传到服务器。客户端发起一个 HTTPS POST 请求，其中 content-type 为 multipart/form-data。使用前请注意阅读相关说明。
 * @param {Object} object 参数
 * @param {string} object.url 开发者服务器地址
 * @param {string} object.filePath 要上传文件资源的路径
 * @param {string} object.name 文件对应的 key，开发者在服务端可以通过这个 key 获取文件的二进制内容
 * @param {Object} [object.header] HTTP 请求 Header，Header 中不能设置 Referer
 * @param {Object} [object.formData] HTTP 请求中其他额外的 form data
 * @param {Object} [object.timeout] 超时时间，单位为毫秒
 * @param {function} [object.success] 接口调用成功的回调函数
 * @param {function} [object.fail] 接口调用失败的回调函数
 * @param {function} [object.complete] 接口调用结束的回调函数（调用成功、失败都会执行）
 * @returns {UploadTask}
 */
const uploadFile = ({ url, filePath, name, header, formData, timeout, success, fail, complete }) => {
  let task = {}
  let promise = new Promise((resolve, reject) => {
    task = createLoadTask(apiName, taskApiName, {
      url,
      filePath,
      name,
      header,
      formData,
      timeout,
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

export default uploadFile
