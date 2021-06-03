/*!
 * @cloudbase/weda-cloud-sdk
 * Copyright© 2021 Tencent
 */
!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?t(exports,require("mobx"),require("@cloudbase/js-sdk")):"function"==typeof define&&define.amd?define(["exports","mobx","@cloudbase/js-sdk"],t):t((e="undefined"!=typeof globalThis?globalThis:e||self).CloudSDK={},e.mobx,e.cloudbase)}(this,(function(e,t,n){"use strict";function r(e){return e&&"object"==typeof e&&"default"in e?e:{default:e}}var a=r(n),o=function(e,t){return(o=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(e,t){e.__proto__=t}||function(e,t){for(var n in t)Object.prototype.hasOwnProperty.call(t,n)&&(e[n]=t[n])})(e,t)};function u(e,t,n,r){return new(n||(n=Promise))((function(a,o){function u(e){try{i(r.next(e))}catch(e){o(e)}}function s(e){try{i(r.throw(e))}catch(e){o(e)}}function i(e){var t;e.done?a(e.value):(t=e.value,t instanceof n?t:new n((function(e){e(t)}))).then(u,s)}i((r=r.apply(e,t||[])).next())}))}function s(e,t){var n,r,a,o,u={label:0,sent:function(){if(1&a[0])throw a[1];return a[1]},trys:[],ops:[]};return o={next:s(0),throw:s(1),return:s(2)},"function"==typeof Symbol&&(o[Symbol.iterator]=function(){return this}),o;function s(o){return function(s){return function(o){if(n)throw new TypeError("Generator is already executing.");for(;u;)try{if(n=1,r&&(a=2&o[0]?r.return:o[0]?r.throw||((a=r.return)&&a.call(r),0):r.next)&&!(a=a.call(r,o[1])).done)return a;switch(r=0,a&&(o=[2&o[0],a.value]),o[0]){case 0:case 1:a=o;break;case 4:return u.label++,{value:o[1],done:!1};case 5:u.label++,r=o[1],o=[0];continue;case 7:o=u.ops.pop(),u.trys.pop();continue;default:if(!(a=u.trys,(a=a.length>0&&a[a.length-1])||6!==o[0]&&2!==o[0])){u=0;continue}if(3===o[0]&&(!a||o[1]>a[0]&&o[1]<a[3])){u.label=o[1];break}if(6===o[0]&&u.label<a[1]){u.label=a[1],a=o;break}if(a&&u.label<a[2]){u.label=a[2],u.ops.push(o);break}a[2]&&u.ops.pop(),u.trys.pop();continue}o=t.call(e,u)}catch(e){o=[6,e],r=0}finally{n=a=0}if(5&o[0])throw o[1];return{value:o[0]?o[1]:void 0,done:!0}}([o,s])}}}var i=function(e){function t(t,n){var r=e.call(this,n)||this;return r.code=t,r.name="TCBError",r}return function(e,t){function n(){this.constructor=e}o(e,t),e.prototype=null===t?Object.create(t):(n.prototype=t.prototype,new n)}(t,e),t}(Error);function c(e,t){return!!e&&Object.prototype.hasOwnProperty.call(e,t)}var f,l={},d={};function p(e){if(!f)throw new Error("app config not inited");return e?f[e]:f}function h(e){f=Object.assign(f||{},e)}function v(e){return function(e,t){return"lcap-"+e.id+"-"+e.name+(t?"-preview":"")}(e,!(null==f?void 0:f.isProd))}function m(e,t){return e.length===t.length&&e.every((function(e,n){return e===t[n]}))}var b=[];function y(e){for(var t=[],n=1;n<arguments.length;n++)t[n-1]=arguments[n];var r=b.find((function(n){return n[0]===e&&m(n[1],t)}));if(r)return r[2];var a=e.apply(void 0,t);return b.push([e,t,a]),a}function g(e,t){if(!e)return e;return t.reduce((function(t,n){return c(e,n)&&(t[n]=e[n]),t}),{})}function w(e){return u(this,void 0,void 0,(function(){var t,n,r,a,o,u;return s(this,(function(s){switch(s.label){case 0:if(s.trys.push([0,2,,3]),(t=p("beforeDSRequest"))&&t(e),!(n=l[e.dataSourceName]))throw new Error("datasource "+e.dataSourceName+" not found");if(!(r=n[e.methodName]))throw new Error("method "+e.methodName+" not found in datasource "+e.dataSourceName+" ");return[4,r(e.params)];case 1:return a=s.sent(),(u=p("afterDSRequest"))&&u(e,null,a),[2,a];case 2:throw o=s.sent(),(u=p("afterDSRequest"))&&u(e,o),o;case 3:return[2]}}))}))}function S(e){return u(this,void 0,void 0,(function(){return s(this,(function(t){switch(t.label){case 0:return[4,p("initTcb")()];case 1:return[4,t.sent().app.callFunction(e)];case 2:return[2,t.sent()]}}))}))}var O={get dataSources(){return h({parseBusinessInfo:!0}),l},get callDataSource(){return h({parseBusinessInfo:!0}),w}},j={wrapperDatasourceMethod:function(e){return function(t){return O.callDataSource({dataSourceName:e.dataSourceName,methodName:e.methodName,params:t})}}},P=Object.assign(O,{utils:j,getCloudInstance:function(){return u(this,void 0,void 0,(function(){return s(this,(function(e){switch(e.label){case 0:return[4,p("initTcb")()];case 1:return[2,e.sent().app]}}))}))},callFunction:S}),D={};function N(e,t){var n=D[e];return n&&"function"==typeof n?n(t):n}function k(e){var t=[];if("database"===e.type){var n=e.config.defaultMethods||e.config.methods||[];t.push.apply(t,n)}e.methods&&t.push.apply(t,e.methods.map((function(e){return e.name})));var r,a={$setDefaultParams:(r=e.name,function(e){D[r]=e})};return t.reduce((function(t,n){return t[n]=function(e,t){return function(n){return u(this,void 0,void 0,(function(){var r,a,o,u,c,f;return s(this,(function(s){switch(s.label){case 0:(r=p("parseBusinessInfo"))&&h({parseBusinessInfo:!1}),a=v(e||{}),s.label=1;case 1:return s.trys.push([1,3,,4]),o={params:n,methodName:t},[4,S({name:a,data:{methodName:t,defaultParams:N(e.name,o),params:n}})];case 2:if(u=s.sent(),c=u.result,r){if(!c.code)return[2,c.data];throw new i(c.code,c.message)}return[2,u.result];case 3:if(f=s.sent(),console.warn("[weda-cloud-sdk] failed to invoke datasource "+a+"'s method "+t,f),r)throw f;return[2,{code:f.errCode||-2,message:f.errMsg||f.message}];case 4:return[2]}}))}))}}(e,n),t}),a)}var _={get $call(){return h({parseBusinessInfo:!1}),w}};function T(){Object.keys(l).forEach((function(e){Object.defineProperty(_,e,{get:function(){return h({parseBusinessInfo:!1}),l[e]},enumerable:!0})}))}function E(e,t){var n=e.split(".");if(2===n.length){var r=d[n[0]],a=n[1];if(r&&(c(r.state.$status,a)||c(r.state,a))){if(r.state.$status[a]){if(t instanceof Error)return void(r.state.$status[a]={status:"failed",code:t.code||-1,message:t.message,error:t});"success"!==r.state.$status[a].status&&(r.state.$status[a]={status:"success"})}r.state[a]=t}}else console.warn("[weda-cloud-sdk]setStateVar: invalid varPath",e)}T();var I={setState:E,setParams:function(e,t){var n=(p("datasetProfiles")||{})[e],r=d[e];r&&n&&n.params&&(r.params=g(t,Object.keys(n.params)))}};function x(e,t){if(e){var n=Object.keys(e);if(!n.length)return{};return n.reduce((function(n,r){if(n[r]="",t){var a=e[r];n[r]=a.sampleValue||""}return n}),{})}}function C(e){if(!e)return{};return Object.keys(e).reduce((function(t,n){var r=e[n];return"state"!==r.varType||(t[n]=r.initialValue),t}),{})}function $(e){var t=e.dataSourceProfiles;if(h(e),t){var n=p("customCreateDataSources");if(n)return n(t),void Object.assign(_,l);t.reduce((function(e,t){return e[t.name]=k(t),e}),l),T()}}function A(){return u(this,void 0,void 0,(function(){var e,t,n,r,o;return s(this,(function(u){switch(u.label){case 0:return e=p(),t=window._WedaHostConfig,n=(null==t?void 0:t.tcbInstance)?t.tcbInstance:a.default.init({env:e.envID}),r=n.auth({persistence:"local"}),o=r.hasLoginState(),(null==t?void 0:t.login)?(o&&"ANONYMOUS"!==o.loginType||t.login(),[3,3]):[3,1];case 1:return o?[3,3]:[4,r.anonymousAuthProvider().signIn()];case 2:u.sent(),u.label=3;case 3:return[2,{app:n}]}}))}))}function M(){return u(this,void 0,void 0,(function(){return s(this,(function(e){return[2,y(A)]}))}))}$({initTcb:M}),e.CLOUD_SDK=P,e.DATASET_CONTEXT=d,e.DS_API=l,e.DS_SDK=_,e.EXTRA_API=I,e._setConfig=h,e.callDataSource=w,e.createDataset=function(e,n){var r=(p("datasetProfiles")||{})[e],a=t.observable({state:{$status:{}},params:{}});if(d[e]=a,!r)return a;var o=x(r.params,n),u=C(r.state);return Object.assign(a.params,o),Object.assign(a.state,u),a},e.createParamsVar=x,e.createStateDataSourceVar=function(e,t){var n,r;return u(this,void 0,void 0,(function(){var a,o,i,c=this;return s(this,(function(f){return a=null===(n=d[e])||void 0===n?void 0:n.state,o=p("datasetProfiles")||{},i=null===(r=o[e])||void 0===r?void 0:r.state,a&&i?(Object.keys(i).forEach((function(n){return u(c,void 0,void 0,(function(){var r,o,u,c;return s(this,(function(s){switch(s.label){case 0:if("datasource"!==(r=i[n]).varType)return[2];if(!r.initMethod||!r.initMethod.name)return a[n]={},a.$status[n]={status:"idle"},[2];s.label=1;case 1:return s.trys.push([1,3,,4]),a.$status[r.name]={status:"loading"},o=r.initMethod,[4,P.callDataSource({dataSourceName:r.dataSourceName,methodName:o.name,params:t(o.params,o),options:{showLoading:!0}})];case 2:return u=s.sent(),E(e+"."+r.name,u),[3,4];case 3:return c=s.sent(),console.error("[weda-cloud-sdk] failed to init "+e+"."+r.name,c),E(e+"."+r.name,c),[3,4];case 4:return[2]}}))}))})),[2]):[2]}))}))},e.createStaticStateVar=C,e.execOnce=y,e.generateParamsParser=function(e){return function(t){if(!t)return t;var n={};return Object.keys(t).forEach((function(r){n[r]=t[r](e.app,e.$page)})),n}},e.getCloudFnName=v,e.getConfig=p,e.initTcb=M,e.isSameArray=m,e.pick=g,e.setConfig=$,Object.defineProperty(e,"__esModule",{value:!0})}));