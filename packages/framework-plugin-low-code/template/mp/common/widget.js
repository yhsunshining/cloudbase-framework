import { observable, autorun, untracked } from 'mobx'
import { styleToCss } from './style'
import { getDeep } from './util'

/**
 * convert widget prop to data for wxml
 * @param {*} props
 */
function resolveWidgetProp(props) {
  let { classList = [] } = props
  const data = {
    ...props,
    style: styleToCss(props.style),
    className: classList.join ? classList.join(' ') : classList
  }
  const extraProps = ['id', 'classList', 'parent', 'children', 'widgetType',
    '_disposers', '_parentId', '_forItems' ]
  extraProps.map(prop => {
    delete data[prop]
  })
  Object.keys(data).map(prop => {
    if (data[prop] instanceof Function || data[prop] === undefined) {
      delete data[prop]
    }
  })
  return data
}

// widget prop -> wxml data
export function resolveWidgetData(props) {
  if (!Array.isArray(props)) {
    return resolveWidgetProp(props)
  }
  return props.map(resolveWidgetData)
}


export function createWidgets(widgetProps, dataBinds, widgetHolder, ownerMpInst) {
  const nodeTree = createWidgetTree(widgetProps, dataBinds)
  const widgets = runFor(widgetProps, dataBinds, nodeTree, {}, null, null, [], widgetHolder, ownerMpInst)
  return widgets
}

/**
 *
 * @param {*} curForNode
 * @param {*} forItems
 * @param {*} parentForWidgets
 * @param {*} parentWidget
 * @returns top level widgets or for dispose
 */
function runFor(widgetProps, dataBinds, curForNode, forItems, parentForWidgets, parentWidget, failedBinds, widgetHolder, ownerMpInst) {
  const nodeId = curForNode.id
  if (!curForNode.value) {  // Root virtual node
    return createSubTree(curForNode, {}, 0, widgetHolder)
  }
  const dispose = autorun(() => {
    let forList = []
    try {
      forList = dataBinds[nodeId]._waFor(forItems.lists, forItems.itemsById)
      if (!Array.isArray(forList)) {
        forList = []
      }
    } catch (e) {
      console.error('For binding error', e)
    }

    // Track list change (e.g. push)
    forList.forEach(e => { })

    untracked(() => {
      disposeWidgets(parentForWidgets[curForNode.id])

      // clean widgets array of previous for run
      dfsTree(curForNode, (node) => {
        const arr = parentForWidgets[node.id]
        arr.splice(forList.length, arr.length)
      })
      // clean widget.children
      if (parentWidget) {
        const curNodeChildren = parentWidget.children.filter(node => node.id.split(idSeparator)[0] === curForNode.id)
        const extraChildren2del = curNodeChildren.slice(forList.length)
        // Remove extra children only
        parentWidget.children = parentWidget.children.filter(node => extraChildren2del.indexOf(node) === -1)
      }

      forList.forEach((item, index) => {
        let { lists = [], itemsById = {}, } = forItems
        const _forItems = {
          lists: [{ currentItem: item, currentIndex: index }, ...lists],
          itemsById: { ...itemsById, [nodeId]: item },
        }
        const widgets = createSubTree(curForNode, _forItems, index)
        widgets[curForNode.id]._forItems = _forItems
      })

    })

  })

  return dispose

  function createSubTree(curForNode, forItems, index, widgetHolder) {
    const widgets = widgetHolder || {}
    const indexPostfix = (forItems.lists || []).slice().reverse().map(list => idSeparator + list.currentIndex).join('')

    // traverse down the tree to set up all widgets
    dfsTree(curForNode, (node, parentNode) => {
      const parentForWidgetArr = parentForWidgets && parentForWidgets[node.id] || []
      const prevWidget = index < parentForWidgetArr.length ? parentForWidgetArr[index] : null  // try to reuse previous node when rerun for

      if (node.forCount === curForNode.forCount) { // Leaf node
        let w = prevWidget
        if (!prevWidget) {
          w = observable(widgetProps[node.id])
          w.id = node.id + indexPostfix
          if (node === curForNode) {
            w._disposers = []
          }
          mountBuiltinWigetsAPI(w, ownerMpInst)
          w.children = []
          const parent = parentNode ? widgets[parentNode.id] : parentWidget
          if (parent) {
            w.parent = parent
            parent.children.push(w)
          }
          parentForWidgetArr.push(w)
        }
        widgets[node.id] = w

        // Setup data binds
        Object.keys(dataBinds[node.id] || {}).map(prop => {
          if (prop === '_waFor') { return }
          const setUpDataBind = () => {
            let firstRunError = null
            const dispose = autorun(() => {
              try {
                // Computed data bind in the next tick since data bind may read widgets data
                w[prop] = dataBinds[node.id][prop](forItems.lists, forItems.itemsById)
              } catch (e) {
                firstRunError = e
                console.error(`Error computing data bind ${node.id}.${prop}`, e)
              }
            })
            if (firstRunError) {
              dispose()
              failedBinds.push(setUpDataBind)
            } else {
              curForNode.id && widgets[curForNode.id]._disposers.push(dispose)
            }
          }
          setUpDataBind()
        })
      } else if (!prevWidget) {
        const len = parentForWidgetArr.push(observable([]))
        widgets[node.id] = parentForWidgetArr[len - 1]
      } else {
        widgets[node.id] = prevWidget
      }
    })

    // run for of next level
    dfsTree(curForNode, (node, parentNode) => {
      if (node.forCount === curForNode.forCount + 1 && dataBinds[node.id] && dataBinds[node.id]._waFor) {
        widgets[node.id]._disposers = { dataBinds: [] }
        const dispose = runFor(widgetProps, dataBinds, node, forItems, widgets, node.parent && widgets[node.parent.id], failedBinds, null, ownerMpInst)
        curForNode.id && widgets[curForNode.id]._disposers.push(dispose)
      }
    })

    // Retry failed databinds
    const len = failedBinds.length
    for (let i = 0; i < len; i++) {
      const setUpDataBind = failedBinds.shift()
      setUpDataBind()
    }

    return widgets
  }
}

export function findForItemsOfWidget(widget) {
  const forItems = widget._forItems
  if (forItems) return forItems
  if (widget.parent) return findForItemsOfWidget(widget.parent)
}

const idSeparator = '-'

/**
 *
 * @param {*} owner Mp page or component instance
 * @param {*} comp Mp component instance or event.currentTarget, the component to convert
 */
export function mpCompToWidget(owner, comp) {
  const { widgets } = owner.getWeAppInst()
  return getDeep(widgets, comp.id, idSeparator)
}

/**
 * Add parent, children to widget
 */
function createWidgetTree(widgets, dataBinds) {
  const virtualRoot = { children: [], forCount: 0 }
  const nodes = Object.keys(widgets).reduce((result, id) => {
    const w = widgets[id]
    result[id] = { id, value: w, _order: w._order, children: [], parent: null, forCount: 0 }
    delete w._order
    return result
  }, {})

  // Create widgets tree API
  Object.keys(nodes).map(id => {
    const curNode = nodes[id]
    const parent = nodes[widgets[id]._parentId]
    //delete widgets[id]._parentId
    if (!parent) {
      virtualRoot.children.push(curNode)
      return
    }
    curNode.parent = parent
    parent.children.push(curNode)
  })

  // Sort children
  Object.keys(nodes).map(id => {
    nodes[id].children.sort((a, b) => a._order - b._order)
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
function disposeWidgets(widgets) {
  widgets.forEach((widget) => {
    const disposers = widget._disposers
    if (disposers) {
      disposers.map(dispose => dispose())
      disposers.splice(0, disposers.length)
    }
    disposeWidgets(widget.children)
  })
}

/* export function createInitData(widgets, dataBinds, keyPrefix = '') {
  return Object.keys(widgets).reduce((result, id) => {
    result[keyPrefix + id] = isWidgetInFor(id, widgets, dataBinds) ? [] : resolveWidgetData(widgets[id])
    return result
  }, {})
}

function isWidgetInFor(id, widgets, dataBinds) {
  let curNode = widgets[id]
  let nodeId = id
  while (curNode) {
    if (dataBinds[nodeId] && dataBinds[nodeId]._waFor) {
      return true
    }
    nodeId = curNode._parentId
    curNode = widgets[nodeId]
  }
} */

function mountBuiltinWigetsAPI(widget, owner) {
  widget.findWidgets = function (filter, includeInvisibleDescendants) {
    let { children = [] } = this
    if (!includeInvisibleDescendants) { // include visible widgets only by default
      children = children.filter(e => e._waIf !== false)
    }
    let matched = children.filter(filter)
    children.forEach(w => {
      matched = matched.concat(w.findWidgets(filter, includeInvisibleDescendants))
    })
    return matched
  }

  widget.getWidgetsByType = function (type, includeInvisibleDescendants) {
    return this.findWidgets(w => w.widgetType === type, includeInvisibleDescendants)
  }

  /**
   * Similar to selectOwnerComponent of WX MP: https://developers.weixin.qq.com/miniprogram/dev/reference/api/Component.html
   */
  widget.getOwnerWidget = function () {
    return owner && owner.getWeAppInst().node
  }

  // Will be overwritten by composited component
  widget.getDom = function (fields) {
    return new Promise((resolve, reject) => {
      const query = (owner || wx).createSelectorQuery()
      query.select('#' + this.id).fields(fields, res => {
        resolve(res)
      }).exec()
    })

  }
}
