import { observable, autorun, untracked } from 'mobx'
import { styleToCss } from './style'
import { getDeep } from './util'
import { compLowcodes, create$comp } from './weapp-component'

/**
 * convert widget prop to data for wxml
 * @param {*} props
 */
function resolveWidgetProp(props) {
  let { classList = [] } = props
  const data = {}
  Object.keys(props).forEach(key => {
    if (props[key] instanceof Function || props[key] === undefined) {
      return
    }
    data[key] = props[key]
  })
  data.style = styleToCss(props.style)
  data.className = classList.join ? classList.join(' ') : classList
  const extraProps = ['classList', '_forItems', '_disposers', 'children', 'parent', '_parentId', 'id', '_order', 'widgetType', '$comp']
  extraProps.map(prop => {
    delete data[prop]
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
  const rootNode = createWidgetDataTree(widgetProps, dataBinds)
  return createSubWidgetTree(rootNode, widgetProps, dataBinds, ownerMpInst, widgetHolder)
}

/**
 * @param ownerMpInst The MP page or component instance the widgets belongs to
 * @param ownerForWidgetHolder null for the virtual root node(first run)
 * @param curForNode a component node or a virtual root tree node
 * @returns {widgets: {id1:[], id2}, rootWidget: {children: [], _disposers: [], ...otherProps}}
 */
function createSubWidgetTree(curForNode, widgetProps, dataBinds, ownerMpInst, widgetHolder = {},
  index = 0, forItems = {}, ownerForWidgetHolder = null,
  failedBinds = [], defaultParent = { children: observable([]), _disposers: [] }) {
  const indexPostfix = (forItems.lists || []).slice().reverse().map(list => idSeparator + list.currentIndex).join('')

  // traverse down the tree to set up all widgets
  dfsTree(curForNode, (node) => {
    const parentForWidgetArr = ownerForWidgetHolder && ownerForWidgetHolder[node.id] || []
    const existedWidget = index < parentForWidgetArr.length ? parentForWidgetArr[index] : null  // try to reuse previous node when rerun for

    if (node.forCount === curForNode.forCount) { // Leaf node
      let w = existedWidget
      if (!existedWidget) {
        const parentNode = node.parent
        let parentWidget = null
        if (parentNode) {
          parentWidget = widgetHolder[parentNode.id] || ownerForWidgetHolder[parentNode.id]
        }
        w = createAWidget(widgetProps[node.id], node.id + indexPostfix, parentWidget, ownerMpInst)
        if (!parentWidget) {
          defaultParent.children.push(w)
        }
        parentForWidgetArr.push(w)
      } else {
        disposeWidget(existedWidget, true)
      }
      setUpWidateDataBinds(w, dataBinds[node.id], forItems, failedBinds)
      widgetHolder[node.id] = w
    } else if (!existedWidget) {
      const len = parentForWidgetArr.push(observable([]))
      widgetHolder[node.id] = parentForWidgetArr[len - 1]
    } else {
      // Reuse existed for widget array
      widgetHolder[node.id] = existedWidget
    }
  })

  // run for of next level
  dfsTree(curForNode, (node) => {
    if (node.forCount === curForNode.forCount + 1 && dataBinds[node.id] && dataBinds[node.id]._waFor) {
      // find the node bound with next level for
      const parent = node.parent ? widgetHolder[node.parent.id] : defaultParent
      const dispose = runFor(node, widgetProps, dataBinds, ownerMpInst, forItems, widgetHolder, failedBinds, parent)
      parent._disposers.push(dispose)  // Add the for bind dispose to the parent node of forNode
    }
  })

  // Retry failed databinds
  const len = failedBinds.length
  for (let i = 0; i < len; i++) {
    const setUpDataBind = failedBinds.shift()
    setUpDataBind()
  }

  return { widgets: widgetHolder, rootWidget: widgetHolder[curForNode.id] || defaultParent }
}

/**
 *
 * @param {*} curForNode
 * @param {*} forItems
 * @param {*} parentForWidgets
 * @param {*} parentWidget
 * @returns top level widgets or for dispose
 */
function runFor(curForNode, widgetProps, dataBinds, ownerMpInst, forItems, ownerForWidgetHolder, failedBinds, defaultParent) {
  const nodeId = curForNode.id
  const dispose = autorun(() => {
    let forList = []
    try {
      forList = dataBinds[nodeId]._waFor(forItems.lists, forItems.itemsById)
      if (!Array.isArray(forList)) {
        forList = []
      }
    } catch (e) {
      forList = []
      console.warn('For binding error', e)
    }

    // Track list change (e.g. push)
    forList.forEach(e => { })

    untracked(() => {
      // dispose widgets before reused instead
      // disposeWidgets(parentForWidgets[curForNode.id])

      // clean extra widgets of previous for run
      dfsTree(curForNode, (node) => {
        const arr = ownerForWidgetHolder[node.id]
        const extraWidgets = arr.splice(forList.length, arr.length)
        //console.log('@@ delete widgets', node.id, extraWidgets)

        if (node.id === curForNode.id) {  // clean the root widget.children only(recursive)
          extraWidgets.map(w => {
            disposeWidget(w)
            const { children } = w.parent || defaultParent
            children.remove(w)
            // w.parent = null
          })
        }
      })

      forList.forEach((item, index) => {
        let { lists = [], itemsById = {}, } = forItems
        const _forItems = {
          lists: [{ currentItem: item, currentIndex: index }, ...lists],
          itemsById: { ...itemsById, [nodeId]: item },
        }
        const { rootWidget } = createSubWidgetTree(curForNode, widgetProps, dataBinds, ownerMpInst, {}, index, _forItems, ownerForWidgetHolder, failedBinds, defaultParent)
        rootWidget._forItems = _forItems
      })
    })
  })

  return dispose
}

function createAWidget(props, id, parent, ownerMpInst) {

  const w = observable(props)

  // Builtin props
  Object.defineProperty(w, 'id', { value: id })
  const { widgetType } = w
  delete w.widgetType
  Object.defineProperty(w, 'widgetType', { value: widgetType })

  //w._disposers = []
  //w.children = []
  Object.defineProperty(w, 'children', { value: observable([]) })
  Object.defineProperty(w, '_disposers', { value: observable([]) })
  if (parent) {
    //w.parent = parent
    Object.defineProperty(w, 'parent', { value: parent })
    parent.children.push(w)
  }
  delete w._parentId

  Object.defineProperty(w, '$comp', { value: create$comp(w) })
  mountBuiltinWigetsAPI(w, ownerMpInst)
  return w
}

function setUpWidateDataBinds(w, dataBinds, forItems, failedBinds) {
  Object.keys(dataBinds || {}).map(prop => {
    if (prop === '_waFor') { return }
    const setUpDataBind = () => {
      let firstRunError = null
      const dispose = autorun(() => {
        try {
          // Computed data bind in the next tick since data bind may read widgets data
          w[prop] = dataBinds[prop](forItems.lists, forItems.itemsById)
        } catch (e) {
          if(prop === '_waIf'){
            w[prop] = false
            console.warn(`Error computing data bind ${w.id}.${prop}`, e)
          }else {
            firstRunError = e
            console.error(`Error computing data bind ${w.id}.${prop}`, e)
          }
        }
      })
      if (firstRunError) {
        dispose()
        failedBinds.push(setUpDataBind)
      } else {
        w._disposers.push(dispose)
      }
    }
    setUpDataBind()
  })
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
function createWidgetDataTree(widgets, dataBinds) {
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

// dispose autorun, widget can be the virtual root widget
export function disposeWidget(widget, noRecursive) {
  const disposers = widget._disposers
  disposers.map(dispose => dispose())
  disposers.splice(0, disposers.length)
  !noRecursive && widget.children.forEach(w => disposeWidget(w))
}

export function createInitData(widgets, dataBinds, keyPrefix = '') {
  return Object.keys(widgets).reduce((result, id) => {
    if (!isWidgetInFor(id, widgets, dataBinds)) {
      result[keyPrefix + id] = resolveWidgetData(widgets[id])
    }
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
}

function mountBuiltinWigetsAPI(widget, owner) {
  // #1 builtin APIs
  widget.findWidgets = function (filter, includeInvisibleDescendants) {
    let { children = [] } = this
    if (!includeInvisibleDescendants) { // include visible widgets only by default
      children = children.filter(e => e._waIf !== false)
    }
    const matched = []
    children.forEach(w => {
      if (filter(w)) {
        matched.push(w)
      }
      matched.push(...w.findWidgets(filter, includeInvisibleDescendants))
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

  widget.getConfig = () => ({})

  const lowcode = compLowcodes[widget.widgetType]
  if (lowcode) {
    const { index = {}, config } = lowcode

    widget.getConfig = () => config

    // #2 User defined APIs
    const { publicMethods = {} } = index
    Object.keys(publicMethods).map(name => {
      const method = publicMethods[name]
      if (method instanceof Function) {
        Object.defineProperty(widget, name, { value: method.bind(widget.$comp) })
        Object.defineProperty(widget.$comp, name, { value: method })
      } else {
        console.error(`Component(${widget.widgetType}) method(${name}) is not a function.`)
      }
    })
  }

}
