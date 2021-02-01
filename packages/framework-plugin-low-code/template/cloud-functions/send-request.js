"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const request_1 = __importDefault(require("request"));
const url_1 = __importDefault(require("url"));
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
 * replace placeholder with actual value in params
 * // TODO: fields should be normalized from raw datasource config
 * @param fields fields object with placeholders
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
 *
 */
function parseFields(fields, params) {
    if (!fields)
        return;
    return JSON.parse(JSON.stringify(fields, (key, val) => {
        if (typeof val !== 'string' || !/\{\{([^}]+)\}\}/.test(val))
            return val;
        const name = RegExp.$1.trim();
        return params[name];
    }, 2));
}
function sendRequest(ds, methodConfig, params, requestCb) {
    const dsConfig = ds.config || {};
    if (methodConfig.type !== 'http')
        throw new Error(`method ${methodConfig.name} not a valid http datasource method`);
    const httpConfig = methodConfig.calleeBody;
    const requestUrl = dsConfig.baseUrl ? url_1.default.resolve(dsConfig.baseUrl, httpConfig.url) : httpConfig.url;
    if (!/^https?:\/\//i.test(requestUrl))
        throw new Error('invalid request url');
    const requestMethod = httpConfig.method.toUpperCase();
    const requestConfig = {
        uri: requestUrl,
        method: requestMethod,
        headers: {}
    };
    if (dsConfig.header || httpConfig.header) {
        const headerFields = mergeFields(dsConfig.header, httpConfig.header.values);
        requestConfig.headers = parseFields(headerFields, params) || {};
    }
    // set referer to avoid referer check
    requestConfig.headers['Referer'] = requestUrl;
    requestConfig.headers['User-Agent'] = 'CloudBaseLowCode/2.0';
    if (['POST', 'PUT', 'PATCH'].includes(requestMethod) && httpConfig.body) {
        const body = parseFields(httpConfig.body.values, params);
        if (httpConfig.body.contentType === 'form') {
            requestConfig.form = body;
        }
        else {
            requestConfig.body = body;
            requestConfig.json = true;
        }
    }
    if (httpConfig.query) {
        const query = parseFields(httpConfig.query.values, params);
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
