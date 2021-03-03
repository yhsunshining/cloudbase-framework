"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const send_request_1 = __importDefault(require("./send-request"));
const cloud_methods_1 = __importDefault(require("./cloud-methods"));
const datasource_profile_1 = __importDefault(require("./datasource-profile"));
const json_transform_1 = require('./json-transform');
function getMethod(methodName) {
    // @ts-ignore
    const dsConfig = datasource_profile_1.default;
    const methodConfig = dsConfig.methods && dsConfig.methods.find(method => method.name === methodName);
    if (!methodConfig) {
        throw new Error(`method ${methodName} not found in datasource, or not enabled in this datasource`);
    }
    if (methodConfig.type === 'http') {
        return function (params, context) {
            return send_request_1.sendRequest(dsConfig, methodConfig, context, params)
              .then((res) => json_transform_1.transformJSONWithTemplate(res,methodConfig.outParams));
        };
    }
    if (methodConfig.type === 'cloud-function') {
        // @ts-ignore
        const method = cloud_methods_1.default[methodName];
        if (!method)
            throw new Error(`method ${methodName} not generated in datasource, please report a issue to admin`);
        return method;
    }
    // @ts-ignore
    throw new Error(`datasource method ${methodName}'s type ${methodConfig.type} not supported`);
}
exports.default = getMethod;
