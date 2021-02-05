"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const request_1 = __importDefault(require("request"));
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
function mergeFields(fields, fields1) {
    // one of them is empty
    if (!fields !== !fields1)
        return fields || fields1;
    // both are empty, return empty
    if (!fields)
        return fields;
    return Object.assign({}, fields, fields1);
}
/**
 * replace placeholder with actual value in params tpl
 * @param paramsTpl params object with placeholders
 *    e.g. var fields = {
 *             name: '{{userName}}',
 *             desc: 'my xxxxxx',
 *             age: 232,
 *             location: {
 *                 title: '{{myTitle}}',
 *                 geo: {
 *                     lat: 232.2323,
 *                     long: '{{long}}'
 *                 }
 *             }
 *         }
 * @param params object stores values of placeholders
 *    e.g. var params = {
 *         "userName": "xiu",
 *         "myTitle": "girlFriend",
 *         "long": {
 *           "a": "xx",
 *           "b": "xxx"
 *         }
 *       }
 */
function parseFields(paramsTpl, params) {
    if (!paramsTpl)
        return;
    return JSON.parse(JSON.stringify(paramsTpl, (key, val) => {
        if (typeof val !== 'string' || !/\{\{([^}]+)\}\}/.test(val))
            return val;
        // full match, replace whole
        if (/^\{\{([^}]+)\}\}$/.test(val.trim())) {
            const name = RegExp.$1.trim();
            return getProp(params, name);
        }
        // placeholders just partial of the string
        return val.replace(/\{\{([^}]+)\}\}/g, ($0, $1) => {
            const name = $1.trim();
            return getProp(params, name);
        });
    }, 2));
}
/**
 * 解析URL地址
 *  这里不使用node的 url.resolve, 因为会与用户预期不一致 url.resolve('http://example.com/one', '/two');    // 'http://example.com/two'
 * 本算法采取字符串拼接方式来解析URL, 并能移除多余的 / , 也能自动补充缺少的 /
 */
function resolveUrl(baseUrl, url) {
    if (!baseUrl || /^https?\:\/\//i.test(url || ''))
        return url;
    if (!url)
        return baseUrl;
    // 处理路径 / 问题
    const baseUrlEndsWithSlash = baseUrl.lastIndexOf('/') === baseUrl.length - 1;
    var urlStartsWithSlash = url.indexOf('/') === 0;
    if (baseUrlEndsWithSlash && urlStartsWithSlash) {
        return baseUrl + url.slice(1);
    }
    else if (baseUrlEndsWithSlash || urlStartsWithSlash) {
        return baseUrl + url;
    }
    else {
        return baseUrl + '/' + url;
    }
}
function sendRequest(ds, methodConfig, context, params, requestCb) {
    const dsConfig = ds.config || {};
    if (methodConfig.type !== 'http')
        throw new Error(`method ${methodConfig.name} not a valid http datasource method`);
    const httpConfig = methodConfig.calleeBody;
    const requestUrl = resolveUrl(dsConfig.baseUrl, httpConfig.url);
    if (!/^https?:\/\//i.test(requestUrl))
        throw new Error('invalid request url');
    const requestMethod = httpConfig.method.toUpperCase();
    const requestConfig = {
        uri: requestUrl,
        method: requestMethod,
        headers: {}
    };
    const fieldParams = { params, env: context.envInfo };
    if (dsConfig.header || httpConfig.header) {
        const headerFields = mergeFields(dsConfig.header, httpConfig.header.values);
        requestConfig.headers = parseFields(headerFields, fieldParams) || {};
    }
    // set referer to avoid referer check
    requestConfig.headers['Referer'] = requestUrl;
    requestConfig.headers['User-Agent'] = 'CloudBaseLowCode/2.0';
    if (['POST', 'PUT', 'PATCH'].includes(requestMethod) && httpConfig.body) {
        const body = parseFields(httpConfig.body.values, fieldParams);
        switch (httpConfig.body.contentType) {
            case 'form':
                requestConfig.form = body;
                break;
            case 'json':
                requestConfig.body = body;
                requestConfig.json = true;
                break;
            case 'xml':
                requestConfig.body = String(body);
                requestConfig.headers['Content-Type'] = 'application/xml;charset=UTF-8';
                break;
            case 'raw':
            default:
                requestConfig.body = String(body);
        }
    }
    if (httpConfig.query) {
        const query = parseFields(httpConfig.query.values, fieldParams);
        requestConfig.qs = query;
    }
    return new Promise((resolve, reject) => {
        request_1.default(requestConfig, (error, response, body) => {
            if (requestCb) {
                requestCb(error, response, body, resolve, reject);
                return;
            }
            if (error) {
                return reject(error);
            }
            const bodyType = typeof body;
            if (bodyType === 'object') {
                return resolve(body);
            }
            if (bodyType === 'string') {
                try {
                    return resolve(JSON.parse(body));
                }
                catch (error) {
                    return reject(new Error(`invalid json string: ${body}`));
                }
            }
            reject(new Error(`unsupported response body type ${bodyType}`));
        });
    });
}
exports.default = sendRequest;
