import { observable, autorun, untracked } from 'mobx'
import { remove } from 'lodash'
import { checkVisible } from '@govcloud/weapps-core'


export function isSlot(comp) {
  return !comp['x-props']
}

export function getWidgetsByType(widget, parentType, type, includeInvisibleDescendants) {
  if (!widget) return []

  let { children = [] } = widget
  let matched = children.filter(c => c.widgetType === type)
  if(!includeInvisibleDescendants) {
    children = children.filter(item => checkVisible(item))
    matched = matched.filter(item => checkVisible(item))
  }
  children.forEach(child => {
    // 如果递归过程中发现了自己，则停止递归
    if (child.widgetType === parentType) return
    matched = matched.concat(getWidgetsByType(child, parentType, type))
  })
  return matched
}

const retryQueue = []
export function retryDataBinds() {
  retryQueue.forEach(fn => {
    try {
      fn()
    } catch(e) {
      console.error(e)
    }
    retryQueue.shift()
  })
}
export function createWidgets(widgetProps, dataBinds) {
  const nodeTree = createWidgetTree(widgetProps, dataBinds)
  const widgets = runFor(nodeTree, {}, null, null)
  return widgets

  /**
   *
   * @param {*} curForNode
   * @param {*} forItems
   * @param {*} parentLevelWidgets
   * @param {*} parentWidget
   * @returns top level widgets or for dispose
   */
  function runFor(curForNode, forItems, parentLevelWidgets, parentWidget) {
    const nodeId = curForNode.id
    if (!curForNode.value) {
      return createSubTree(curForNode, {})
    }
    const dispose = autorun(() => {
      let forList = []
      try {
        forList = dataBinds[nodeId]._waFor(forItems)
      } catch(e) {
        console.error('waFor error', e)
      }

      if(!Array.isArray(forList)) {
        console.warn(nodeId, 'For 循环绑定的数据并不是数组，请检查')
        return 
      }

      untracked(() => {
        disposeWidgets(parentLevelWidgets[curForNode.id])

        // clean nodes of previouse for run
        dfsTree(curForNode, (node) => {
          const arr = parentLevelWidgets[node.id]
          arr.splice(0, arr.length)
          parentWidget && remove(parentWidget.children, ({ id }) => id === node.id)
        })

        forList.forEach((item, index) => {
          const forItems = { ...forItems, [nodeId]: item }
          createSubTree(curForNode, forItems)
        })

        retryQueue.forEach(fn => {
          retryQueue.shift()
          fn()
        })
      })
    })

    return dispose

    function createSubTree(curForNode, subForItems) {
      const widgets = {}

      // traverse down the tree to set all widgets
      dfsTree(curForNode, (node, parentNode) => {
        if (node.forCount === curForNode.forCount) { // Leaf node
          const w = observable(widgetProps[node.id])
          w.id = node.id
          if (node === curForNode) {
            w._disposers = []
          }
          widgets[node.id] = w
          w.getWidgetsByType = (type, includeInvisibleDescendants) => getWidgetsByType(w, w.widgetType, type, includeInvisibleDescendants)
          // 提供一个给 Node 挂载 API 的方式
          untracked(() => {
            w.extends = (name, fnOrData) => Object.defineProperty(w, name, { value: fnOrData })
          })
          w.children = []
          const parent = parentNode ? widgets[parentNode.id] : parentWidget
          if (parent) {
            w.parent = parent
            // 只有可显示 visible 的才存入 children 里
            if(checkVisible(w)) {
              parent.children.push(w)
            }
          }
          parentLevelWidgets && parentLevelWidgets[node.id].push(w)

          // Setup data binds
          Object.keys(dataBinds[node.id] || {}).map(prop => {
            if (prop === '_waFor') { return }
            (function getBindData() {
              let disposeError = false
              const dispose = autorun(() => {
                try {
                  // Computed data bind in the next tick since data bind may read widgets data
                  w[prop] = dataBinds[node.id][prop](subForItems)
                  disposeError = false
                } catch(e) {
                  retryQueue.push(getBindData)
                  disposeError = true
                }
              })
              !disposeError && curForNode.id && widgets[curForNode.id]._disposers.push(dispose)
            })()
          })
        } else {
          if (parentLevelWidgets) {
            const len = parentLevelWidgets[node.id].push([])
            widgets[node.id] = parentLevelWidgets[node.id][len - 1]
          } else {
            widgets[node.id] = observable([])
          }

        }
      })

      // run for of next level
      dfsTree(curForNode, (node, parentNode) => {
        if (node.forCount === curForNode.forCount + 1 && dataBinds[node.id] && dataBinds[node.id]._waFor) {
          widgets[node.id]._disposers = { dataBinds: [] }
          const dispose = runFor(node, subForItems, widgets, node.parent && widgets[node.parent.id])
          curForNode.id && widgets[curForNode.id]._disposers.push(dispose)
        }
      })

      return widgets
    }
  }
}


/**
 * Add parent, children to widget
 */
function createWidgetTree(widgets, dataBinds) {
  const virtualRoot = { children: [], forCount: 0 }
  const nodes = Object.keys(widgets).reduce((result, id) => {
    result[id] = { id, value: widgets[id], children: [], parent: null, forCount: 0 }
    return result
  }, {})

  // Create widgets tree API
  Object.keys(nodes).map(id => {
    const curNode = nodes[id]
    const parent = nodes[widgets[id]._parentId]
    if (!parent) {
      virtualRoot.children.push(curNode)
      return
    }
    curNode.parent = parent
    parent.children.push(curNode)
  })

  virtualRoot.children.map(addForCount)

  // dfs, add forCount
  function addForCount(node) {
    if (node.parent) {
      node.forCount = node.parent.forCount
    }
    if (dataBinds[node.id] && dataBinds[node.id]._waFor) {
      node.forCount++
    }
    node.children.map(addForCount)
  }

  return virtualRoot
}

function dfsTree(node, fn, parent) {
  node.value && fn(node, parent)
  node.children.map(e => dfsTree(e, fn, node.value ? node : null))
}

// dispose autorun
function disposeWidgets(widgets = []) {
  widgets.forEach((widget) => {
    const disposers = widget._disposers
    if (disposers) {
      disposers.map(dispose => dispose())
      disposers.splice(0, disposers.length)
    }
    disposeWidgets(widget.children)
  })
}