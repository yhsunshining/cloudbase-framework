"use strict";
/**
 将 JSON 按照模版转换为另一种结构
 如, 原始json
{
  user: 'Molly',
  age: 12,
  email: 'molly@gmail.com',
  location: {
    city: 'sz',
    street: 'shennan street',
    zipCode: '2323'
  },
  titles: [
    {
      title: '三好学生',
      date: '2017-11-23'
    },
    {
      title: '优秀干部',
      date: '2017-11-23'
    }
  ]
}
模版
{
  userName: '{{user}}',
  userLevel: 2,
  email: '{{email}}',
  location: {
    address: '{{location.city}} {{location.street}}',
    postCode: '{{location.zipCode}}'
  },
  rewards$titles$: {
    name: '{{$item.title}}',
    no: '{{$index + 1}}',
    releaseDate: '{{$item.date}}'
  }
}
转换得到
{
  userName: 'Molly',
  userLevel: 2,
  email: 'molly@gmail.com',
  location: {
    address: 'sz shennan street',
    postCode: '2323'
  },
  rewards: [
    {
      name: '三好学生',
      no: 1,
      releaseDate: '2017-11-23'
    },
    {
      name: '优秀干部',
      no: 1,
      releaseDate: '2017-11-23'
    }
  ]
}

 JSON Template 结构:
 1. 插值使用 {{}} 包裹, 可以直接访问json的值, 亦可以使用表达式
 2. 除数组外, 模版对象中的值均可用插值方式描述
 3. 数组转换时, 因需要同时描述需要循环的字段及值的结构, 描述方式会略有不同:
    循环字段在模版对象的键值中描述, 采用 key$loopKeyPath$ 形式
    值依旧使用插值方式来描述数组成员, 插值中可以使用 $item 访问循环的值, 使用 $index 访问循环索引
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformJSONWithTemplate = void 0;
function evaluateCode(code, context) {
    return Function(`with(this){ return (${code})}`).apply(context);
}
function evaluateVal(val, context) {
    if (!/\{\{([^}]+)\}\}/.test(val))
        return val;
    try {
        if (/^\{\{([^}]+)\}\}$/.test(val.trim())) {
            return evaluateCode(RegExp.$1, context);
        }
        return val.replace(/\{\{([^}]+)\}\}/g, ($0, $1) => {
            return evaluateCode($1, context);
        });
    }
    catch (error) {
        return val;
    }
}
function evaluateArr(template, json, keyPath) {
    const arr = getProp(json, keyPath);
    // 找不到对应成员
    if (!Array.isArray(arr))
        return [];
    return arr.map((item, idx) => {
        const context = Object.assign({}, json, {
            $index: idx,
            $item: item
        });
        return transformJSONWithTemplate(context, template);
    });
}
/**
 * get value from obj with key path(lodash.get alternative)
 * @param obj object to extract value from
 * @param keyPath value key path, e.g: a.b.c, a[0][3].s.d.e
 * @param defaultValue if get undefined, use defaultValue instead
 */
function getProp(obj, keyPath, defaultValue) {
    let paths = Array.isArray(keyPath) ? keyPath : String(keyPath).replace(/\[(\d+)\]/g, '.$1').split('.');
    let idx = 0;
    let len = paths.length;
    while (obj != null && idx < len) {
        obj = obj[paths[idx]];
        ++idx;
    }
    return typeof obj === 'undefined' ? defaultValue : obj;
}
function transformJSONWithTemplate(json, template) {
    if (!json || !template)
        return template;
    const combinedJson = Object.assign({}, json, { $root: json });
    if (typeof template === 'string')
        return evaluateVal(template, combinedJson);
    if (Array.isArray(template))
        return template.map(item => transformJSONWithTemplate(json, item));
    const keys = Object.keys(template);
    if (!keys.length)
        return {};
    // no key
    if (keys.length === 1 && /^\$(.+)\$$/.test(keys[0])) {
        return evaluateArr(template[keys[0]], combinedJson, RegExp.$1);
    }
    return keys.reduce((acc, cur) => {
        let arrKeyPath = '';
        const key = cur.replace(/\$(.+)\$$/, ($0, $1) => {
            arrKeyPath = $1;
            return '';
        });
        acc[key] = arrKeyPath ? evaluateArr(template[cur], combinedJson, arrKeyPath) : transformJSONWithTemplate(json, template[cur]);
        return acc;
    }, {});
}
exports.transformJSONWithTemplate = transformJSONWithTemplate;
