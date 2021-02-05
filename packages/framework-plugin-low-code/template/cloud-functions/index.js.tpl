"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = void 0;
const node_sdk_1 = __importDefault(require("@cloudbase/node-sdk"));
const utils_1 = require("./utils");
const get_method_1 = __importDefault(require("./get-method"));
const app = node_sdk_1.default.init({
    env: node_sdk_1.default.SYMBOL_CURRENT_ENV
});
const auth = app.auth();
const db = app.database();
/** 数据源对应云数据库集合名称, 数据源类型为数据库时该值才有意义 */
const COLLECTION_NAME = '<%= collectionName %>'
/**
 * 获取 context 注入的环境信息
 * {
 *   openId, //微信openId，非微信授权登录则空
 *   appId, //微信appId，非微信授权登录则空
 *   uid, //用户唯一ID
 *   customUserId //开发者自定义的用户唯一id，非自定义登录则空
 * }
 */
function getEnvInfo() {
    return auth.getUserInfo();
}
async function main(params, context) {
    // 自定义操作的context
    const cfContext = {
        cloudbase: node_sdk_1.default,
        app,
        auth,
        database: db,
        envInfo: getEnvInfo(),
        collection: COLLECTION_NAME ? db.collection(COLLECTION_NAME) : undefined
    };
    try {
        const method = get_method_1.default(params.methodName);
        const result = await method(params.params, cfContext);
        return {
            code: 0,
            data: result
        };
    }
    catch (e) {
        if (e instanceof utils_1.TCBError) {
            return {
                code: e.code || -1,
                message: e.message
            };
        }
        return {
            code: -1,
            message: e.message
        };
    }
}
exports.main = main;
