import { get as lodashGet, set as lodashSet } from 'lodash';

export function createComputed(funcs, bindContext = null) {
  const obj = {};
  for (const name in funcs) {
    Object.defineProperty(obj, name, {
      get: bindContext ? funcs[name].bind(bindContext) : funcs[name],
    });
  }
  return obj;
}

/*
根据 object对象的path路径获取值。 如果解析 value 是 undefined 会以 defaultValue 取代。
*/
export function getter(context, path, defaultValue = undefined) {
  return lodashGet(context, path, defaultValue);
}

/*
设置 object对象中对应 path 属性路径上的值，如果path不存在，则创建。 缺少的索引属性会创建为数组，而缺少的属性会创建为对象。 使用_.setWith 定制path创建
*/
export function setter(context, path, value = undefined) {
  return lodashSet(context, path, value);
}

export function checkVisible({ _visible }) {
  return _visible !== false && _visible !== '';
}
