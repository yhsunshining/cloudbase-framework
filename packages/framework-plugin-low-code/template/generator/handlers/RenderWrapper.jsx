import * as React from 'react';
import { useRef } from 'react';
import { CompRenderer } from './NodeRenderer';
import lodashSet from 'lodash.set';
import cloneDeep from 'lodash.clonedeep';
import { isScopeSlot } from '../utils/common';

function getComponentChildren(component) {
  const { properties } = component;
  if (!properties) {
    return [];
  }
  return Object.values(properties).sort(
    (a, b) => (a['x-index'] || 0) - (b['x-index'] || 0)
  );
}

export function AppRender(props) {
  const {
    className,
    virtualFields,
    componentSchema,
    renderSlot,
    rootNode = true,
    codeContext,
    scopeContext = {},
  } = props;
  const {
    'x-props': xProps,
    properties = {},
    genericComp = {},
  } = componentSchema;
  // 判断是否为 slot
  const isSlot = !xProps;
  if (isSlot && !(renderSlot || rootNode)) {
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
  const children = getComponentChildren(componentSchema);
  const slots = {};
  // eslint-disable-next-line guard-for-in
  for (const key in properties) {
    const child = properties[key];
    if (!child['x-props'] && child.properties) {
      slots[key] = isScopeSlot(componentSchema, key) ? (
        (props) => {
          let clonedScopeContext = cloneDeep(scopeContext);
          lodashSet(
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

  return (
    <CompRenderer
      id={componentSchema.key}
      xProps={xProps}
      emitEvents={componentSchema.emitEvents || []}
      componentSchema={componentSchema}
      virtualFields={virtualFields}
      slots={slots}
      codeContext={codeContext}
      scopeContext={scopeContext}
      genericComp={genericComp}
    >
      {children.map((comp) => (
        <AppRender
          key={comp.key}
          componentSchema={comp}
          rootNode={false}
          renderSlot={false}
          virtualFields={virtualFields}
          codeContext={codeContext}
          scopeContext={scopeContext}
        />
      ))}
    </CompRenderer>
  );
}
