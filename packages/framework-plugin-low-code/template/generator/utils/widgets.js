import * as React from 'react';
import { observable, autorun, untracked } from 'mobx';
import remove from 'lodash.remove';
import { EventProxy } from './eventProxy';

export const widgetKeys = [
  'getConfig',
  'findWidgets',
  'getWidgetsByType',
  'extends',
  'on',
  'off',
  'getOwnerWidget',
  'getDom',
  'domRef',
];

export const WidgetsContext = React.createContext({ parent: null });

export function isSlot(comp) {
  return !comp['x-props'];
}

export function checkVisible({ _visible }) {
  return _visible !== false && _visible !== '';
}

// 实现和小程序一致的 API，以兼容多端
// widget.getDom({ rect: true })
// https://developers.weixin.qq.com/miniprogram/dev/api/wxml/NodesRef.fields.html
export function getDom(element, options) {
  if (!element) {
    console.warn('getDom 接口未传入有效的 element');
    return Promise.resolve({});
  }

  let result = {};
  if (options.id) result.id = element.id;
  if (options.dataset) result.dataset = element.dataset;
  if (options.rect) {
    const rect = element.getBoundingClientRect();
    Object.assign(result, {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
    });
  }
  if (options.size) {
    const rect = element.getBoundingClientRect();
    Object.assign(result, {
      width: rect.width,
      height: rect.height,
    });
  }
  if (options.scrollOffset) {
    Object.assign(result, {
      scrollLeft: element.scrollLeft,
      scrollTop: element.scrollTop,
    });
  }
  if (options.properties && Array.isArray(options.properties)) {
    options.properties.forEach((propName) => {
      result[propName] = element.getAttribute(propName);
    });
  }
  if (options.computedStyle && Array.isArray(options.computedStyle)) {
    const computedStyle = window.getComputedStyle(element);
    options.computedStyle.forEach((propName) => {
      result[propName] = computedStyle[propName];
    });
  }

  return Promise.resolve(result);
}

export function findWidgets(
  widget,
  parentType,
  filterFn,
  includeInvisibleDescendants
) {
  if (!widget) return [];

  let { children = [] } = widget;
  let matched = children.filter(filterFn);

  // 过滤掉不可见后代
  if (!includeInvisibleDescendants) {
    children = children.filter((item) => checkVisible(item));
  }

  children.forEach((child) => {
    // 如果递归过程中发现了自己，则停止递归
    matched = matched.concat(
      findWidgets(child, parentType, filterFn, includeInvisibleDescendants)
    );
  });

  // 过滤掉不可见的匹配项
  if (!includeInvisibleDescendants) {
    matched = matched.filter((item) => checkVisible(item));
  }

  return matched;
}

const retryQueue = [];
// 递归执行
export function retryDataBinds(tryTime = 10) {
  const fn = retryQueue.shift();
  if (!fn || tryTime <= 0) return;
  try {
    fn({ showLog: tryTime <= 1 });
  } catch (e) {
    console.error('retryDataBinds', e);
  }
  retryDataBinds(tryTime - 1);
}
export function createWidgets(widgetProps, dataBinds) {
  const nodeTree = createWidgetTree(widgetProps, dataBinds);
  const widgets = runFor(nodeTree, {}, null, null);
  return widgets;

  /**
   *
   * @param {*} curForNode
   * @param {*} forItems
   * @param {*} parentLevelWidgets
   * @param {*} parentWidget
   * @returns top level widgets or for dispose
   */
  function runFor(curForNode, forItems, parentLevelWidgets, parentWidget) {
    const nodeId = curForNode.id;
    if (!curForNode.value) {
      return createSubTree(curForNode, {});
    }
    const dispose = autorun(() => {
      let forList = [];
      try {
        forList = dataBinds[nodeId]._waFor(forItems);
      } catch (e) {
        console.error('waFor error', e);
      }

      if (!Array.isArray(forList)) {
        console.warn(nodeId, 'For 循环绑定的数据并不是数组，请检查');
        return;
      }

      // 让 forList 进行监听
      forList.forEach(() => {});
      untracked(() => {
        disposeWidgets(parentLevelWidgets[curForNode.id]);

        // clean nodes of previouse for run
        dfsTree(curForNode, (node) => {
          const arr = parentLevelWidgets[node.id];
          arr.splice(0, arr.length);
          parentWidget &&
            remove(parentWidget.children, ({ id }) => id === node.id);
        });

        forList.forEach((item, index) => {
          const subForItems = { ...forItems, [nodeId]: item };
          createSubTree(curForNode, subForItems);
        });

        // 非初始化时遇到需要重新构建 dataBinds
        retryDataBinds();
      });
    });

    return dispose;

    function createSubTree(curForNode, subForItems) {
      const widgets = {};

      // traverse down the tree to set all widgets
      dfsTree(curForNode, (node, parentNode) => {
        if (node.forCount === curForNode.forCount) {
          // Leaf node
          const w = observable(widgetProps[node.id]);
          w.id = node.id;
          if (node === curForNode) {
            w._disposers = [];
          }
          widgets[node.id] = w;
          w._listeners = new EventProxy();
          // 提供一个给 Node 挂载 API 的方式
          untracked(() => {
            w.getConfig = () => ({}); // 兼容非复合组件调用 getConfig 能力
            w.findWidgets = (type, includeInvisibleDescendants) =>
              findWidgets(w, w.widgetType, type, includeInvisibleDescendants);
            w.getWidgetsByType = (type, includeInvisibleDescendants) =>
              w.findWidgets(
                (currentWidget) => currentWidget.widgetType === type,
                includeInvisibleDescendants
              );
            w.extends = (name, fnOrData) =>
              Object.defineProperty(w, name, {
                value: fnOrData,
                writable: true,
              });
            w.on = (name, listener) => w._listeners.on(name, listener);
            w.off = (name, listener) => w._listeners.cancel(name, listener);
            w.getOwnerWidget = () => null; // 默认带上一个 widget
          });
          w.children = [];
          const parent = parentNode ? widgets[parentNode.id] : parentWidget;
          if (parent) {
            w.parent = parent;
            // 只有可显示 visible 的才存入 children 里
            if (checkVisible(w)) {
              parent.children.push(w);
            }
          }
          parentLevelWidgets && parentLevelWidgets[node.id].push(w);

          // Setup data binds
          Object.keys(dataBinds[node.id] || {}).map((prop) => {
            if (prop === '_waFor') {
              return;
            }
            function getBindData(options = {}) {
              let disposeError = false;
              const dispose = autorun(() => {
                try {
                  // Computed data bind in the next tick since data bind may read widgets data
                  w[prop] = dataBinds[node.id][prop](subForItems);
                  disposeError = false;
                } catch (e) {
                  if (prop === '_waIf') {
                    w[prop] = false;
                    console.warn(
                      `Error computing data bind ${w.id}.${prop}`,
                      e
                    );
                  } else {
                    options.showLog && console.error(e);
                    retryQueue.push(getBindData);
                    disposeError = true;
                  }
                }
              });
              if (!disposeError && curForNode.id) {
                widgets[curForNode.id]._disposers.push(dispose);
              }
            }
            getBindData();
          });
        } else {
          if (parentLevelWidgets) {
            const len = parentLevelWidgets[node.id].push([]);
            widgets[node.id] = parentLevelWidgets[node.id][len - 1];
          } else {
            widgets[node.id] = observable([]);
          }
        }
      });

      // run for of next level
      dfsTree(curForNode, (node, parentNode) => {
        if (
          node.forCount === curForNode.forCount + 1 &&
          dataBinds[node.id] &&
          dataBinds[node.id]._waFor
        ) {
          widgets[node.id]._disposers = { dataBinds: [] };
          const dispose = runFor(
            node,
            subForItems,
            widgets,
            node.parent && widgets[node.parent.id]
          );
          curForNode.id && widgets[curForNode.id]._disposers.push(dispose);
        }
      });

      return widgets;
    }
  }
}

/**
 * Add parent, children to widget
 */
function createWidgetTree(widgets, dataBinds) {
  const virtualRoot = { children: [], forCount: 0 };
  const nodes = Object.keys(widgets).reduce((result, id) => {
    result[id] = {
      id,
      value: widgets[id],
      children: [],
      parent: null,
      forCount: 0,
    };
    return result;
  }, {});

  // Create widgets tree API
  Object.keys(nodes).map((id) => {
    const curNode = nodes[id];
    const parent = nodes[widgets[id]._parentId];
    if (!parent) {
      virtualRoot.children.push(curNode);
      return;
    }
    curNode.parent = parent;
    parent.children.push(curNode);
  });

  virtualRoot.children.map(addForCount);

  // dfs, add forCount
  function addForCount(node) {
    if (node.parent) {
      node.forCount = node.parent.forCount;
    }
    if (dataBinds[node.id] && dataBinds[node.id]._waFor) {
      node.forCount++;
    }
    node.children.map(addForCount);
  }

  return virtualRoot;
}

function dfsTree(node, fn, parent) {
  node.value && fn(node, parent);
  node.children.map((e) => dfsTree(e, fn, node.value ? node : null));
}

// dispose autorun
function disposeWidgets(widgets = []) {
  widgets.forEach((widget) => {
    const disposers = widget._disposers;
    if (disposers) {
      disposers.map((dispose) => dispose());
      disposers.splice(0, disposers.length);
    }
    disposeWidgets(widget.children);
  });
}
