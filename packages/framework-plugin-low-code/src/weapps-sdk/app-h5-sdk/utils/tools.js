export function createAsyncFunc(json, resResult, rejResult) {
  return new Promise((res, rej) => {
    if (json.success) {
      typeof json.success === 'function' && json.success(resResult)
      res(resResult)
    } else {
      typeof json.fail === 'function' && json.fail(rejResult)
      rej(rejResult)
    }
  })
}