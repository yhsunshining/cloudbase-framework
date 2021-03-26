
// 云函数入口函数
exports.main = async (event, context) => {
  // 跨账号鉴权云函数
  // https://developers.weixin.qq.com/miniprogram/dev/wxcloud/guide/resource-sharing/

  return {
    errCode: 0,
    errMsg: '',
    auth: JSON.stringify({
      // 自定义安全规则
      // 在前端访问资源方数据库、云函数等资源时，资源方可以通过
      // 安全规则的 `auth.custom` 字段获取此对象的内容做校验，
      // 像这个示例就是资源方可以在安全规则中通过 `auth.custom.x` 获取
      // x: 1,
    }),
  }
}
