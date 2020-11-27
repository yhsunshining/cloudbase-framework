let appConfig;
export function getConfig(k) {
  if (!appConfig) throw new Error('app config not inited');
  return k ? appConfig[k] : appConfig;
}
export function setConfig(config) {
  appConfig = Object.assign(appConfig || {}, config);
}
/**
 * 为表名、云函数名称增加 低码前缀
 */

export function prefixIdentifier(name) {
  return `lcap-${name}`;
} // 为表名增加前缀, 保证唯一

export function getTableName(ds) {
  let preview = <%= isPreview %>;
  return `lcap-${ds.id}-${ds.name}${preview?'-preview':''}`;
}
/**
 * 获取数据源云函数名称
 * @param dataSourceName 数据源名称, 如果为数据源的云函数, 则该值必填, 以避免不同数据源云函数间重名
 */

export function getCloudFnName(ds) {
  let preview = <%= isPreview %>;
  return prefixIdentifier(`${ds.id}-${ds.name}-<%= appId %>${preview?'-preview':''}`);
}
/** 预置的错误对象, 可用该对象抛出自定义错误代码及错误信息 */

export class TCBError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = 'TCBError';
  }

}
