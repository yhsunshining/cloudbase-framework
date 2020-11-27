import { transformSync } from '@babel/core'
import * as prettier from 'prettier'
import chalk from 'chalk'
import {
  IDynamicValue,
  IWeAppComponentInstance,
  PropBindType,
  IEventModifiers,
} from '../../weapps-core'
import { js2xml } from 'xml-js'
import {
  textContentPropName,
  varSeparator,
  getClassAttrName,
  builtinWigetProps,
  builtinMpEvents,
} from '../config/mp'
import { IBuildContext } from './BuildContext'
import { getWxmlTag } from './materials'
import { walkThroughWidgets } from '../util/weapp'

const error = chalk.redBright

export function generateDataBind4wxml(bind: IDynamicValue, wxmlDataPrefix) {
  if (bind.value == null) {
    console.warn(error('Bad wxml attribute bind'), bind)
  }

  let attrVal = ''
  const { type, value = '' } = bind
  if (type === PropBindType.state) {
    const isGlobalSt = value.startsWith('global.')
    const bindTarget = isGlobalSt ? wxmlDataPrefix.appState : wxmlDataPrefix.pageState
    attrVal = value.replace(/^\$?\w+./, bindTarget + '.')
  } else if (type === PropBindType.forItem) {
    attrVal = wxmlDataPrefix.forItem + value
  } else if (type === PropBindType.expression) {
    // FIXME using ast to replace code
    attrVal = value
      .replace(/\bapp.state./g, wxmlDataPrefix.appState + '.')
      .replace(/\$page.state./g, wxmlDataPrefix.pageState + '.')
      .replace(/\$comp.state./g, wxmlDataPrefix.pageState + '.')
      .replace(/\bapp.computed./g, wxmlDataPrefix.appComputed + '.')
      .replace(/\$page.computed./g, wxmlDataPrefix.pageComputed + '.')
      .replace(/\$comp.computed./g, wxmlDataPrefix.pageComputed + '.')
      .replace(/\$page.widgets./g, wxmlDataPrefix.widgetProp)
      .replace(/\bforItems./g, wxmlDataPrefix.forItem)
      .replace(/\$comp.props.data./g, '')
  } else if (type === PropBindType.computed) {
    const isGlobalSt = value.startsWith('global.')
    const bindTarget = isGlobalSt ? wxmlDataPrefix.appComputed : wxmlDataPrefix.pageComputed
    attrVal = value.replace(/^\$?\w+./, bindTarget + '.')
  } else if (type === PropBindType.prop) {
    attrVal = value
  }
  return `{{${transpileJsExpr(attrVal)}}}`
}

interface INode {
  type: string,
  name: string,
  attributes: {
    [key: string]: any
  },
  elements: INode[],
  _order: number,
  _parent: INode | null,
}

export function generateWxml(
  widgets: { [key: string]: IWeAppComponentInstance },
  wxmlDataPrefix,
  ctx: IBuildContext,
  usingComponents,
  nodeTransform?: (cmp: IWeAppComponentInstance, node) => void
) {
  const xmlJson = { elements: createXml(widgets) }

  function createXml(
    widgets: { [key: string]: IWeAppComponentInstance },
    parent: null | INode = null,
    parentForNodes: string[] = []
  ) {
    const elements: INode[] = []
    for (const id in widgets) {
      const { xComponent, xProps, properties, xIndex } = widgets[id]
      const { data: data0 = {}, listeners = [], directives = {} } = xProps || {}

      const data = { ...data0 }
      if (directives.waIf && directives.waIf.value === false) {
        continue
      }
      if (!xComponent) {
        // slot prop
        const slotNodes = createXml(properties as Required<IWeAppComponentInstance>['properties'], parent, parentForNodes)
        slotNodes.forEach(node => {
          node.attributes.slot = id
          parent?.elements?.push(node)
        })
        if (parent) {
          delete parent.attributes[id]
        }
        continue
      }
      const materialLib = ctx.materialLibs[xComponent.moduleName]
      if (!materialLib) {
        console.error('Component lib not found', xComponent)
        continue
      }
      const { tagName, path } = getWxmlTag(xComponent, ctx.materialLibs)
      if (path) {
        usingComponents[tagName] = path
      }

      if (tagName === 'slot') {
        elements.push({
          type: 'element',
          name: tagName,
          attributes: { name: data0.name.value },
          elements: [],
          _order: xIndex || 0,
          _parent: null
        })
        continue
      }
      let curForNodes = parentForNodes
      if (directives.waFor && directives.waFor.value) {
        curForNodes = [...curForNodes, id]
      }

      const attrPrefix = `${wxmlDataPrefix.widgetProp}${id}${curForNodes
        .map(forNodeId => `[${wxmlDataPrefix.forIndex}${forNodeId}]`)
        .join('')}.`

      const node: INode = {
        type: 'element',
        name: tagName,
        attributes: {
          id,
          style: `{{${attrPrefix}style}}`,
          [getClassAttrName(tagName)]: `{{${attrPrefix}className}}`,
        },
        elements: [],
        _order: xIndex || 0,
        _parent: parent,
      }
      const { mustEmptyStyle } =
        ctx.materialLibs[xComponent.moduleName].components[xComponent.name] || {}
      if (mustEmptyStyle) {
        delete node.attributes.style
      }

      if (directives.waIf && directives.waIf.value) {
        node.attributes['wx:if'] = `{{${attrPrefix}_waIf}}`
      }

      if (directives.waFor && directives.waFor.value) {
        node.attributes['wx:for'] = `{{${wxmlDataPrefix.widgetProp}${id}${parentForNodes
          .map(forNodeId => `[${wxmlDataPrefix.forIndex}${forNodeId}]`)
          .join('')}}}`
        node.attributes['wx:for-index'] = wxmlDataPrefix.forIndex + id
        // node.attributes['wx:key'] = 'id'
      }
      for (const prop in data) {
        const { type, value } = data[prop]
        const attrVal = type === PropBindType.prop ? value : `${attrPrefix}${prop}`
        xmlJsonSetCustomAttr(node, prop, `{{${attrVal}}}`)
      }

      // Event binding
      const { inputProps } =
        ctx.materialLibs[xComponent.moduleName].components[xComponent.name] || {}
      Object.entries(inputProps || {}).map(([prop, config]) => {
        const evtName = config.changeEvent
        node.attributes[`bind:${evtName}`] = getMpEventHanlderName(id, evtName)
      })
      listeners.forEach(l => {
        const evtName = getMpEventName(l.trigger)
        const modifiers = l
        node.attributes[getMpEventAttr(evtName, modifiers)] = getMpEventHanlderName(
          id,
          evtName,
          modifiers
        )
      })

      // find ancestor nodes with for lists to mount data-for-indexes
      let curNode = node
      const nodeIdsWithFor: string[] = []
      while (curNode) {
        if (curNode.attributes['wx:for']) {
          nodeIdsWithFor.unshift(curNode.attributes.id)
        }
        curNode = curNode._parent as any
      }
      if (nodeIdsWithFor.length) {
        node.attributes['data-for-ids'] = nodeIdsWithFor.join(varSeparator)
        node.attributes['data-for-indexes'] = nodeIdsWithFor
          .map(id => `{{${wxmlDataPrefix.forIndex}${id}}}`)
          .join(varSeparator)
      }
      node.elements = node.elements.concat(createXml(properties as Required<IWeAppComponentInstance>['properties'], node, curForNodes))
      nodeTransform && nodeTransform(widgets[id], node)
      elements.push(node)
    }
    return elements.sort((a, b) => a._order - b._order)
  }

  return js2xml(xmlJson, {
    spaces: '\t',
    /* textFn: text => {
      return text
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&amp;/g, '&')
    }, */
  })
}

function xmlJsonSetCustomAttr(node, prop: string, value: string) {
  if (builtinWigetProps.indexOf(prop) > -1) {
    console.error(
      error('Builtin prop ' + prop + ' is not allowed for component ' + node.attributes.id)
    )
    return
  }
  node.attributes[prop] = value

  // FIXME Attention, handling innerText
  if (prop === textContentPropName) {
    node.elements.push({ type: 'text', text: value })
  }
}

function transpileJsExpr(expr: string) {
  let result = transformSync(expr, {
    cwd: __dirname, // help to resolve babel plugin
    plugins: [['@babel/plugin-transform-template-literals', { loose: true }]],
  })

  let code = result?.code || ''

  code = prettier.format(code, {
    semi: false,
    singleQuote: true,
    parser: 'babel',
    printWidth: Number.MAX_SAFE_INTEGER,
  })
  return code.substr(0, code.length - 1)
}

const evtNameMap = {
  // eslint-disable-next-line @typescript-eslint/camelcase
  __weapps_action_trigger_click: 'tap',
}

function getMpEventName(originalName: string) {
  return evtNameMap[originalName] || originalName
}

export function getMpEventHanlderName(
  widgetId: string,
  evtName: string,
  modifier: IEventModifiers = {}
) {
  // Only builtin events have will bubble
  if (builtinMpEvents.indexOf(evtName) === -1) {
    modifier = {}
  }
  return `on${widgetId}$${getMpEventName(evtName)}${modifier.isCapturePhase ? '$cap' : ''}${
    modifier.noPropagation ? '$cat' : ''
    }`
}

/* onid3click,  */
function getMpEventAttr(evtName: string, modifier: IEventModifiers) {
  // Only builtin events have will bubble
  if (builtinMpEvents.indexOf(evtName) === -1) {
    modifier = {}
  }
  let prefix = modifier.isCapturePhase ? 'capture-' : ''
  prefix += modifier.noPropagation ? 'catch' : 'bind'
  return prefix + ':' + evtName
}

export function getUsedComponents(
  widgets: { [key: string]: IWeAppComponentInstance },
  usedCmps: { [libName: string]: Set<string> } = {}
) {
  walkThroughWidgets(widgets, (id, widget) => {
    const { xComponent } = widget
    if (!xComponent) return
    const { moduleName, name } = xComponent
    if (!usedCmps[moduleName]) {
      usedCmps[moduleName] = new Set()
    }
    usedCmps[moduleName].add(name)
  })
  return usedCmps
}
