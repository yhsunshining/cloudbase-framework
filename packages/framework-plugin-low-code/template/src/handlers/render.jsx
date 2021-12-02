import * as React from 'react';
import { useRef } from 'react';
import * as _ from 'lodash';
import { getRenderList as getComponentRenderList } from './FieldMiddleware/renderer';
import { isScopeSlot } from '../utils/index';
import { observer } from 'mobx-react-lite';

function checkDoNotRenderSlot(isSlot, renderSlot, rootNode) {
  return isSlot && !(renderSlot || rootNode);
}

function getComponentChildren(
  component,
  { virtualFields, codeContext, scopeContext }
) {
  const { properties } = component;
  if (!properties) {
    return [];
  }
  let list = Object.values(properties).sort(
    (a, b) => (a['x-index'] || 0) - (b['x-index'] || 0)
  );

  const componentChildren = [];
  const rootNode = false;
  const renderSlot = false;
  for (const schema of list) {
    const children = getRenderList({
      key: schema.key,
      componentSchema: schema,
      rootNode,
      renderSlot,
      virtualFields,
      codeContext,
      scopeContext,
    });
    componentChildren.push(children);
  }

  return componentChildren;
}

function getRenderList(props) {
  const {
    className,
    virtualFields,
    componentSchema,
    renderSlot,
    rootNode = true,
    codeContext,
    scopeContext = {},
  } = props;
  const { 'x-props': xProps, properties = {} } = componentSchema;

  // 判断是否为 slot
  const isSlot = !xProps;
  if (checkDoNotRenderSlot(isSlot, renderSlot, rootNode)) {
    return null;
  }

  const preClassName = useRef();

  // wrapperClass
  const containerEl = Object.values(properties)[0];
  if (containerEl && containerEl['x-props'] && className) {
    let { classNameList = [] } = containerEl['x-props'];

    // 先替换掉先前计算出来的className部分
    if (preClassName.current) {
      if (preClassName.current !== className) {
        classNameList = classNameList.filter(
          (clsName) => clsName !== preClassName.current
        );
        preClassName.current = className;
      }
    } else {
      preClassName.current = className;
    }

    containerEl['x-props'].classNameList = [className, ...classNameList];
  }

  if (xProps && xProps.sourceKey) {
    const { sourceKey } = xProps;
    const Field = virtualFields[sourceKey];
    if (!Field) {
      return (
        <div style={{ color: 'red' }}>
          组件<em>{sourceKey}</em>未找到
        </div>
      );
    }
  }

  const slots = {};
  // eslint-disable-next-line guard-for-in
  for (const key in properties) {
    const child = properties[key];
    if (!child['x-props'] && child.properties) {
      slots[key] = isScopeSlot(componentSchema, key) ? (
        (props) => {
          let clonedScopeContext = _.cloneDeep(scopeContext);
          _.set(
            clonedScopeContext,
            `${componentSchema.key}.${child.key}`,
            props
          );
          return (
            <AppRender
              key={child.key}
              componentSchema={child}
              renderSlot
              virtualFields={virtualFields}
              codeContext={codeContext}
              scopeContext={clonedScopeContext}
            />
          );
        }
      ) : (
        <AppRender
          key={child.key}
          componentSchema={child}
          renderSlot
          virtualFields={virtualFields}
          codeContext={codeContext}
          scopeContext={scopeContext}
        />
      );
    }
  }

  // return (
  //   <CompRenderer
  //     id={componentSchema.key}
  //     xProps={xProps}
  //     emitEvents={componentSchema.emitEvents || []}
  //     virtualFields={virtualFields}
  //     slots={slots}
  //     codeContext={codeContext}
  //     scopeContext={scopeContext}
  //   >
  //     {getComponentChildren(componentSchema, {
  //       virtualFields,
  //       codeContext,
  //       scopeContext,
  //     })}
  //   </CompRenderer>
  // );

  return getComponentRenderList({
    id: componentSchema.key,
    xProps,
    emitEvents: componentSchema.emitEvents || [],
    virtualFields,
    slots,
    codeContext,
    scopeContext,
    children: getComponentChildren(componentSchema, {
      virtualFields,
      codeContext,
      scopeContext,
    }),
  });
}

export const AppRender = observer(function (props) {
  return getRenderList(props);
});
