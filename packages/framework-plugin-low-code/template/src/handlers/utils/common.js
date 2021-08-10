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
  if (isPlainProps === 1) {
    staticResourceAttribute && staticResourceAttribute.map(
      (property) => (props.data[property] = getStaticResourceAttribute(props.data[property])),
    );
    return {
      ...props
      }
  };
  let { data = {}, events = [], ...restProps } = props;
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
  staticResourceAttribute.map((prop) => (data[prop] = getStaticResourceAttribute(data[prop])));
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


export function getStaticResourceAttribute(staticUrl){
  if (staticUrl && staticUrl.indexOf('/') !== 0) {
    return staticUrl;
  }
  const { domain = '' } = app;
  const url = `https://${domain}/${staticUrl}`;
  return url;
}
