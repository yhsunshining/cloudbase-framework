/**
 * All data bindings are generated as functions: (forItems) => any
 * @param {*} dataBinds
 * @param {*} forItems
 */
import { app } from '../app/global-api';
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

/**
 * 对函数进行批量绑定
 * @param {*} funcObj
 * @param {*} context
 */
export function bindFuncObj(funcObj = {}, context) {
  return Object.keys(funcObj).reduce((obj, fnName) => {
    obj[fnName] = funcObj[fnName].bind(context);
    return obj;
  }, {});
}

export function kebabCase(str) {
  return str.replace(KEBAB_REGEX, function (match) {
    return '-' + match.toLowerCase();
  });
}

export function camelcase(str, firstUpperCase = false) {
  str = str.replace(/[_-]([a-z])/g, function (l) {
    return l[1].toUpperCase();
  });

  if (firstUpperCase) str = str.charAt(0).toUpperCase() + str.slice(1);

  return str;
}

export const isEmptyObj = (obj) => {
  if (!isPlainObject(obj)) {
    return false;
  }
  for (const i in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, i)) {
      return false;
    }
  }
  return true;
};

export function isPlainObject(src) {
  return Object.prototype.toString.call(src) === '[object Object]';
}

/**
 * 用于处理自定义组件props传参结构，对系统变量进行保留
 */
export function resolveComponentProps(props, isPlainProps) {
  const { staticResourceAttribute } = props;
  if (isPlainProps === 1) {
    const { data = {}, ...restProps } = props;
    staticResourceAttribute &&
      staticResourceAttribute.map(
        (property) =>
          (data[property] = getStaticResourceAttribute(data[property]))
      );
    return {
      ...data,
      ...restProps,
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
  // delete builtin props
  builtinProps.map((prop) => delete customProps[prop]);
  staticResourceAttribute &&
    staticResourceAttribute.map(
      (prop) =>
        data[prop] && (data[prop] = getStaticResourceAttribute(data[prop]))
    );
  return {
    ...data,
    ...restProps,
    events: new Proxy(
      events.reduce((events, item) => {
        const propName = item;
        events[propName] = (e) => restProps.emit(propName, e);
        return events;
      }, {}),
      {
        get(obj, prop) {
          return prop in obj ? obj[prop] : (e) => restProps.emit(prop, e);
        },
      }
    ),
  };
}

const SCOPE_SLOT_COMPONENT_LIB = ['tea_basis', 'tea_shop', 'crm_basis'];

const SCOPE_SLOT_MAP = SCOPE_SLOT_COMPONENT_LIB.reduce((map, lib) => {
  map[`${lib}:TableMatching`] = {
    headerSlot: true,
    recordSlot: true,
  };

  map[`${lib}:TableExpanded`] = {
    headerSlot: true,
    recordSlot: true,
  };

  map[`${lib}:TabsTable`] = {
    headerSlot: true,
    recordSlot: true,
  };

  map[`${lib}:Table`] = {
    headerSlot: true,
    recordSlot: true,
  };

  return map;
}, {});

export function isScopeSlot(comp, slot) {
  const { 'x-props': xProps } = comp;
  const sourceKey = xProps && xProps.sourceKey;
  const map = SCOPE_SLOT_MAP[sourceKey];
  return map && map[slot];
}

export function getStaticResourceAttribute(staticUrl) {
  const { domain = '' } = app;
  if (staticUrl && staticUrl.indexOf('/') !== 0) {
    return staticUrl;
  }
  const url = `${domain}${staticUrl}`;
  return url;
}
/**
 * 检查页面权限
 **/
export async function checkAuth(app, appId, pageId) {
  app.showNavigationBarLoading();
  const checkAuthResult = await app.cloud.checkAuth({
    type: 'app',
    extResourceId: `${appId}-${pageId}`,
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
  return isLogin;
}
