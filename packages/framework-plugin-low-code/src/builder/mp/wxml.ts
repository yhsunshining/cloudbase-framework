import { transformSync } from '@babel/core';
import * as prettier from 'prettier';
import chalk from 'chalk';
import {
  IDynamicValue,
  IWeAppComponentInstance,
  PropBindType,
  IEventModifiers,
} from '../../weapps-core';
import { js2xml } from 'xml-js';
import {
  textContentPropName,
  getClassAttrName,
  builtinWigetProps,
  builtinMpEvents,
  builtinMpTags,
  nativeCompWhiteList,
} from '../config/mp';
import { IBuildContext } from './BuildContext';
import { getWxmlTag } from './materials';
import { walkThroughWidgets } from '../util/weapp';
import NameMangler from '../util/name-mangler';

const error = chalk.redBright;

// export function generateDataBind4wxml(bind: IDynamicValue, wxmlDataPrefix) {
//   if (bind.value == null) {
//     console.warn(error('Bad wxml attribute bind'), bind)
//   }

//   let attrVal = ''
//   const { type, value = '' } = bind
//   if (type === PropBindType.state) {
//     const isGlobalSt = value.startsWith('global.')
//     const bindTarget = isGlobalSt
//       ? wxmlDataPrefix.appState
//       : wxmlDataPrefix.pageState
//     attrVal = value.replace(/^\$?\w+./, bindTarget + '.')
//   } else if (type === PropBindType.forItem) {
//     attrVal = wxmlDataPrefix.forItem + value
//   } else if (type === PropBindType.expression) {
//     // FIXME using ast to replace code
//     attrVal = value
//       .replace(/\bapp.state./g, wxmlDataPrefix.appState + '.')
//       .replace(/\$page.state./g, wxmlDataPrefix.pageState + '.')
//       .replace(/\$comp.state./g, wxmlDataPrefix.pageState + '.')
//       .replace(/\bapp.computed./g, wxmlDataPrefix.appComputed + '.')
//       .replace(/\$page.computed./g, wxmlDataPrefix.pageComputed + '.')
//       .replace(/\$comp.computed./g, wxmlDataPrefix.pageComputed + '.')
//       .replace(/\$page.widgets./g, wxmlDataPrefix.widgetProp)
//       .replace(/\bforItems./g, wxmlDataPrefix.forItem)
//       .replace(/\$comp.props.data./g, '')
//   } else if (type === PropBindType.computed) {
//     const isGlobalSt = value.startsWith('global.')
//     const bindTarget = isGlobalSt
//       ? wxmlDataPrefix.appComputed
//       : wxmlDataPrefix.pageComputed
//     attrVal = value.replace(/^\$?\w+./, bindTarget + '.')
//   } else if (type === PropBindType.prop) {
//     attrVal = value
//   }
//   return `{{${transpileJsExpr(attrVal)}}}`
// }

interface INode {
  type: string;
  name: string;
  attributes: {
    [key: string]: any;
  };
  elements: INode[];
  _order: number;
  _parent: INode | null;
}

export function generateWxml(
  widgets: { [key: string]: IWeAppComponentInstance },
  docTag: string,
  wxmlDataPrefix,
  ctx: IBuildContext & { isPage: boolean },
  usingComponents,
  nodeTransform?: (cmp: IWeAppComponentInstance, node) => void
) {
  const nameMangler = ctx.isProduction
    ? new NameMangler({ blackList: builtinMpTags })
    : undefined;
  const xmlJson = { elements: createXml(widgets) };
  if (ctx.isPage) {
    const originElements = xmlJson.elements;
    if (originElements?.length) {
      if (!originElements[0]?.attributes) {
        originElements[0].attributes = {};
      }
      originElements[0].attributes['data-weui-theme'] = 'light';
    }
    // 登录校验: 向其最外层包裹一层block
    xmlJson.elements = [
      {
        type: 'element',
        name: 'block',
        attributes: {
          ['wx:if']: '{{weDaHasLogin}}',
        },
        elements: originElements,
        _order: -1,
        _parent: null,
      },
    ];
  }

  function createXml(
    widgets: { [key: string]: IWeAppComponentInstance },
    parent: null | INode = null,
    parentForNodes: string[] = []
  ) {
    const elements: INode[] = [];
    for (const id in widgets) {
      const { xComponent, xProps, properties, xIndex } = widgets[id];
      const {
        data: data0 = {},
        listeners = [],
        directives = {},
      } = xProps || {};

      const data = { ...data0 };
      if (directives.waIf && directives.waIf.value === false) {
        continue;
      }
      if (!xComponent) {
        // slot prop
        const slotNodes = createXml(
          properties as Required<IWeAppComponentInstance>['properties'],
          parent,
          parentForNodes
        );
        slotNodes.forEach((node) => {
          node.attributes.slot = id;
          parent?.elements?.push(node);
        });
        if (parent) {
          delete parent.attributes[id];
        }
        continue;
      }
      const componentKey = xComponent.moduleName + ':' + xComponent.name;
      const helpMsg = `Please check component(${id}) in component tree of ${docTag}.`;

      const materialLib = ctx.materialLibs.find(
        (lib) => lib.name === xComponent.moduleName
      );

      const miniprogramPlugin = ctx.miniprogramPlugins?.find(
        (plugin) => plugin.name === xComponent.moduleName
      );

      if (!materialLib && !miniprogramPlugin) {
        console.error(
          error(`Component lib(${xComponent.moduleName}) not found. ${helpMsg}`)
        );
        continue;
      }
      const componentProto = materialLib
        ? materialLib.components.find((comp) => comp.name === xComponent.name)
        : miniprogramPlugin?.componentConfigs.find(
            (comp) => comp.name === xComponent.name
          );

      if (!componentProto) {
        console.error(
          error(
            `Component(${xComponent.name}) not found in lib(${xComponent.moduleName}). ${helpMsg}`
          )
        );
        continue;
      }
      const { tagName, path } = getWxmlTag(xComponent, ctx, nameMangler);

      if (path) {
        usingComponents[tagName] = path;
      }

      if (tagName === 'slot') {
        elements.push({
          type: 'element',
          name: tagName,
          attributes: { name: data0.name.value },
          elements: [],
          _order: xIndex || 0,
          _parent: null,
        });
        continue;
      }
      let curForNodes = parentForNodes;
      if (directives.waFor && directives.waFor.value) {
        curForNodes = [...curForNodes, id];
      }

      const attrPrefix = `${wxmlDataPrefix.widgetProp}${id}${curForNodes
        .map((forNodeId) => `[${wxmlDataPrefix.forIndex}${forNodeId}]`)
        .join('')}.`;

      const idAttr =
        curForNodes.length < 1
          ? id
          : `{{'${id}'${curForNodes
              .map(
                (forNodeId) => `+ '-' + ${wxmlDataPrefix.forIndex}${forNodeId}`
              )
              .join('')}}}`;

      const node: INode = {
        type: 'element',
        name: tagName,
        attributes: {
          id: idAttr,
          style: `{{${attrPrefix}style}}`,
          [getClassAttrName(tagName)]: `{{${attrPrefix}className}}`,
        },
        elements: [],
        _order: xIndex || 0,
        _parent: parent,
      };
      const { mustEmptyStyle } = componentProto.meta || {};
      if (mustEmptyStyle) {
        delete node.attributes.style;
      }

      if (directives.waIf && directives.waIf.value) {
        node.attributes['wx:if'] = getAttrBind(
          directives.waIf,
          `${attrPrefix}_waIf`
        );
      }

      if (directives.waFor && directives.waFor.value) {
        node.attributes['wx:for'] = getAttrBind(
          directives.waFor,
          `${wxmlDataPrefix.widgetProp}${id}${parentForNodes
            .map((forNodeId) => `[${wxmlDataPrefix.forIndex}${forNodeId}]`)
            .join('')}`
        );
        node.attributes['wx:for-index'] = wxmlDataPrefix.forIndex + id;
        node.attributes['wx:key'] = 'id';
      }
      const compSchema = componentProto.dataForm;
      for (const prop in data) {
        if (compSchema) {
          const fieldDef = compSchema[prop];
          if (!fieldDef) {
            console.log(
              error(
                `Prop(${prop}) does not exist on ${componentKey}. ${helpMsg}`
              )
            );
            continue;
          }
          if (fieldDef.readOnly) {
            if (fieldDef.hasOwnProperty('default')) {
              node.attributes[prop] = fieldDef.default;
            } else {
              console.error(
                error(
                  `Readonly property(${prop}) of ${componentKey} must have a default value. ${helpMsg}`
                )
              );
            }
            continue;
          }
        }
        xmlJsonSetCustomAttr(
          node,
          prop,
          getAttrBind(data[prop], `${attrPrefix}${prop}`),
          xComponent
        );
      }

      // Event binding
      const { inputProps, syncProps } = componentProto.meta || {};
      const syncConfigs = syncProps || inputProps || {};
      Object.entries(syncConfigs).map(([prop, config]) => {
        const configs = Array.isArray(config) ? config : [config];
        configs.forEach(({ changeEvent: evtName }) => {
          // 兼容微信 7.0.13 安卓版本 textarea 组件的 bindinput 事件，bind:input 写法，事件会失效
          const sep = getEventBindSep(tagName);
          node.attributes[`bind${sep}${evtName}`] = getMpEventHanlderName(
            id,
            evtName
          );
        });
      });
      listeners.forEach((l) => {
        const evtName = getMpEventName(l.trigger);
        const modifiers = l;
        node.attributes[getMpEventAttr(evtName, modifiers, tagName)] =
          getMpEventHanlderName(id, evtName, modifiers);
      });

      // 扩展组件配置
      const compConfig = componentProto.compConfig;
      if (compConfig && compConfig.pluginConfig) {
        if (compConfig.pluginConfig.attributes) {
          Object.assign(node.attributes, compConfig.pluginConfig.attributes);
        }
        if (compConfig.pluginConfig.componentPath) {
          usingComponents[tagName] = compConfig.pluginConfig.componentPath;
        }
      }
      // find ancestor nodes with for lists to mount data-for-indexes
      /* let curNode = node
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
          .map((id) => `{{${wxmlDataPrefix.forIndex}${id}}}`)
          .join(varSeparator)
      }*/
      node.elements = node.elements.concat(
        createXml(
          properties as Required<IWeAppComponentInstance>['properties'],
          node,
          curForNodes
        )
      );

      // 特殊处理 swiper，对swiper 子节点包裹议程 swiperItem
      if (
        tagName === 'swiper' ||
        componentKey === 'weda:Swiper' ||
        componentKey === 'gsd-h5-react:Swiper'
      ) {
        node.elements = node.elements.map((item, index) => {
          let {
            ['wx:for']: wxFor,
            ['wx:for-index']: wxForIndex,
            ['wx:key']: wxKey,
            ...itemRestKey
          } = item.attributes || {};

          if (item.name !== 'swiper-item') {
            let SwiperItem: INode = {
              type: 'element',
              name: 'swiper-item',
              attributes: {
                id: `${
                  item.attributes?.id || node?.attributes?.id + index
                }-item`,
                'wx:for': wxFor,
                'wx:for-index': wxForIndex,
                'wx:key': wxKey,
              },
              elements: [],
              _order: index || 0,
              _parent: node,
            };
            SwiperItem.elements = [
              {
                ...item,
                attributes: {
                  ...itemRestKey,
                },
                _parent: SwiperItem,
              },
            ];
            return SwiperItem;
          } else {
            return item;
          }
        });
      }
      nodeTransform && nodeTransform(widgets[id], node);
      elements.push(node);
    }
    return elements.sort((a, b) => a._order - b._order);
  }

  return js2xml(xmlJson, {
    spaces: '\t',
    /* textFn: text => {
      return text
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&amp;/g, '&')
    }, */
  });
}

function xmlJsonSetCustomAttr(node, prop: string, value: string, comp) {
  if (builtinWigetProps.indexOf(prop) > -1) {
    console.error(
      error('Builtin prop(' + prop + ') is not allowed for custom component'),
      comp
    );
    return;
  }
  node.attributes[prop] = value;

  // FIXME Attention, handling innerText
  if (prop === textContentPropName) {
    node.elements.push({ type: 'text', text: value });
  }
}

function transpileJsExpr(expr: string) {
  let result = transformSync(expr, {
    cwd: __dirname, // help to resolve babel plugin
    plugins: [['@babel/plugin-transform-template-literals', { loose: true }]],
  });

  let code = result?.code || '';

  code = prettier.format(code, {
    semi: false,
    singleQuote: true,
    parser: 'babel',
    printWidth: Number.MAX_SAFE_INTEGER,
  });
  return code.substr(0, code.length - 1);
}

const evtNameMap = {
  // eslint-disable-next-line @typescript-eslint/camelcase
  __weapps_action_trigger_click: 'tap',
};

function getMpEventName(originalName: string) {
  // 模板中也有部分依赖保持相同的连字符(_)，更改时注意同步修改
  return evtNameMap[originalName] || originalName.replace(/\./g, '_');
}

export function getMpEventHanlderName(
  widgetId: string,
  evtName: string,
  modifier: IEventModifiers = {}
) {
  // Only builtin events have will bubble
  if (builtinMpEvents.indexOf(evtName) === -1) {
    modifier = {};
  }
  return `on${widgetId}$${getMpEventName(evtName)}${
    modifier.isCapturePhase ? '$cap' : ''
  }${modifier.noPropagation ? '$cat' : ''}`;
}

/* onid3click,  */
function getMpEventAttr(
  evtName: string,
  modifier: IEventModifiers,
  tagName: string
) {
  // Only builtin events have will bubble
  if (builtinMpEvents.indexOf(evtName) === -1) {
    modifier = {};
  }
  let prefix = modifier.isCapturePhase ? 'capture-' : '';
  prefix += modifier.noPropagation ? 'catch' : 'bind';
  const sep = getEventBindSep(tagName);
  return prefix + sep + evtName;
}

function getEventBindSep(tagName: string) {
  // bind:input => bindinput 兼容微信 7.0.13 安卓版本 textarea 组件，bind:input 写法会导致事件失效
  return nativeCompWhiteList.includes(tagName.toLowerCase()) ? '' : ':';
}

export function getUsedComponents(
  widgets: { [key: string]: IWeAppComponentInstance },
  usedCmps: { [libName: string]: Set<string> } = {}
) {
  walkThroughWidgets(widgets, (id, widget) => {
    const { xComponent } = widget;
    if (!xComponent) return;
    const { moduleName, name } = xComponent;
    if (!usedCmps[moduleName]) {
      usedCmps[moduleName] = new Set();
    }
    usedCmps[moduleName].add(name);
  });
  return usedCmps;
}

function getAttrBind(dVale: IDynamicValue, widgetBind: string) {
  const { type, value } = dVale;
  const attrVal = type === PropBindType.prop ? value : widgetBind;
  return `{{${attrVal}}}`;
}
