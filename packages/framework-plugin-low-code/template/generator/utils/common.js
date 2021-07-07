/**
 * All data bindings are generated as functions: (forItems) => any
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
export function resolveComponentProps(props) {
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

const SCOPE_SLOT_MAP = {
  ['tea_shop:TableMatching']: {
    headerSlot: true,
    recordSlot: true,
  },
  ['tea_shop:TableExpanded']: {
    headerSlot: true,
    recordSlot: true,
  },
  ['tea_shop:TabsTable']: {
    headerSlot: true,
    recordSlot: true,
  },
  ['tea_shop:Table']: {
    headerSlot: true,
    recordSlot: true,
  },
  ['tea_basis:TableMatching']: {
    headerSlot: true,
    recordSlot: true,
  },
  ['tea_basis:TableExpanded']: {
    headerSlot: true,
    recordSlot: true,
  },
  ['tea_basis:TabsTable']: {
    headerSlot: true,
    recordSlot: true,
  },
  ['tea_basis:Table']: {
    headerSlot: true,
    recordSlot: true,
  },
};

export function isScopeSlot(comp, slot) {
  const { 'x-props': xProps } = comp;
  const sourceKey = xProps && xProps.sourceKey;
  const map = SCOPE_SLOT_MAP[sourceKey];
  return map && map[slot];
}
