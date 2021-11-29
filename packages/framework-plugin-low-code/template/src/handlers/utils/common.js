import config from '../../datasources/config'
export function getComponentId(key) {
  return `__weapps-component-wrapper-${key}`;
}

export const pathSpecialSymbol = '__$__';

export function pathTransformDotToSymbol(str) {
  return str.replace(/\./g, pathSpecialSymbol);
}

export function pathTransformSymbolToDot(str) {
  return String(str).replace(new RegExp(`__\\$__`, 'g'), '.');
}

/**
 * All data bindings are generated as functions: (forItems, event?) => any
 * @param {*} dataBinds
 * @param {*} forItems
 */
export function resolveDataBinds(
  dataBinds,
  forItems,
  codeContext,
  scopeContext,
  throwError
) {
  const resolvedProps = {};
  for (const prop in dataBinds) {
    let fn = dataBinds[prop];
    try {
      if (codeContext && codeContext.$WEAPPS_COMP) {
        fn = fn.bind(codeContext.$WEAPPS_COMP);
      }
      resolvedProps[prop] = fn(
        forItems,
        codeContext && codeContext.event,
        scopeContext
      );
    } catch (e) {
      console.error('Error resolving data binding', prop, dataBinds[prop], e);
      if (throwError) {
        throw e;
      }
    }
  }
  return resolvedProps;
}

const varSeparator = '.';
export function getDeep(target, key) {
  if (key == null) {
    return target;
  }
  const keys = (key + '').split(varSeparator);
  let prop = target[keys[0]];
  for (let i = 1; i < keys.length; i++) {
    prop = prop[keys[i]];
  }
  return prop;
}

/**
 * 用于处理自定义组件props传参结构，对系统变量进行保留
 */
export function resolveComponentProps(props, isPlainProps) {
  const { staticResourceAttribute } = props;
  staticResourceAttribute &&
    staticResourceAttribute.map((property) => {
      if (props.data && props.data[property]) {
        props.data[property] = getStaticResourceAttribute(props.data[property]);
      }
    });
  if (!isPlainProps) {
    return {
      ...props,
    };
  }
  const { data = {}, events = [], ...restProps } = props;
  const customProps = { ...data };
  const builtinProps = [
    // react 保留字
    'ref',
    'key',
    'dangerouslySetInnerHTML',
    'className',
    'htmlFor',
    'style',
    'contentEditable',
    // lowcode 保留字
    'events',
    'children',
    '_parentId',
    '_visible',
    'classList',
    'widgetType',
    'getWidgetsByType',
    'getDom',
    'domRef',
    'extends',
    // 小程序保留字
    'id',
    'class',
    'hidden',
    'slot',
  ];
  builtinProps.map((prop) => delete customProps[prop]);
  return {
    ...data,
    ...restProps,
    events: events.reduce((events, item) => {
      const propName = item;
      events[propName] = (e) => restProps.emit(propName, e);
      return events;
    }, {}),
  };
}

export function getStaticResourceAttribute(staticUrl) {
  if (/^\//.test(staticUrl)) {
    const { domain = '' } = window.app || {};
    const url = `https://${domain}${staticUrl}`;
    return url;
  }
  return staticUrl;
}
/**
 * 检查页面权限
 **/
const _AUTH_CACHE_MAP = {}
export async function checkAuth(app, appId, pageId) {
  <% if(isAdminPortal){ %>return true;<% } %>
  const cacheKey = `${appId}-${pageId}`
  if(_AUTH_CACHE_MAP[cacheKey] !== undefined) {
    return _AUTH_CACHE_MAP[cacheKey]
  }
  app.showNavigationBarLoading();
  const checkAuthResult = await app.cloud.callWedaApi({
    action: 'DescribeResourcesPermission',
    data: {
      ResourceType: `<%= isAdminPortal? 'modelApp' : 'app'%>`,
      ResourceIdList: [cacheKey],
    },
  });
  let isLogin = false;
  if (Array.isArray(checkAuthResult) && checkAuthResult.length > 0) {
    isLogin = checkAuthResult[0]?.IsAccess ?? false;
  }
  app.hideNavigationBarLoading();

  if (!isLogin) {
    app.showToast({
      title: '页面无访问权限',
      icon: 'error',
    });
  }
  _AUTH_CACHE_MAP[cacheKey] = isLogin
  return isLogin;
}

const _REPORTED = {}
export function reportTime(tag, time, only=false){
  if(!window._aegis || !tag){
    return;
  }
  if(window['_WedaHostConfig'] && !window['_WedaHostConfig']['_REPORTED']) {
    window['_WedaHostConfig']['_REPORTED'] = _REPORTED
  }

  const CACHE_MAP = window['_WedaHostConfig']?.['_REPORTED'] || _REPORTED

  if(only && CACHE_MAP[tag]){
    return ;
  }
  CACHE_MAP[tag] = true
  try {
    let t = time === undefined? (performance?.now?.() || Date.now() - window['_aegis_inited']) :time;
    window._aegis.reportTime({
      name: tag,
      duration: t,
      ext2: config.isProd? 'production' : 'preview',
    })
  }catch(e){
    console.log(e)
  }
}
