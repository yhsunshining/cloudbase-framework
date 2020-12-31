import {
  IDynamicValue,
  IWeAppComponentInstance,
  PropBindType,
  toCssStyle,
  compositedComponentApi,
  ActionType,
} from '../../weapps-core'
import { walkThroughWidgets } from '../util/weapp'
import { IBuildContext } from './BuildContext'
import { getMpEventHanlderName } from './wxml'
import { builtinWigetProps } from '../config/mp'

export function extractWidgetProps(
  props: Required<IWeAppComponentInstance>['xProps']
) {
  const { classList } = props
  const staticProps: any = {
    style: toCssStyle(props.commonStyle, {
      toRpx: true,
      toRem: false,
    }),
    classList: classList || [],
  }
  const { data = {} } = props
  Object.assign(staticProps, generatedDynamicData(data).staticProps)
  return staticProps
}

export function generatedDynamicData(data: { [key: string]: IDynamicValue }) {
  const staticProps = {}
  const boundProps = {}
  for (const key in data) {
    if (builtinWigetProps.indexOf(key) > -1) continue
    const { type, value } = data[key]
    if (!type || type === 'static') {
      staticProps[key] = value
    } else {
      boundProps[key] = generateDataBind(data[key])
    }
  }
  return { staticProps, boundProps }
}

// For JS
export function generateDataBind(bind: IDynamicValue) {
  let expr = ''
  const { type, value } = bind
  if (type === PropBindType.forItem) {
    expr = `forItems.${value}`
  } else if (type === PropBindType.expression) {
    expr = `${value.replace(/\$comp./g, `${compositedComponentApi}.`)}`
  } else if (type === PropBindType.prop) {
    const isNegated = value.startsWith('!')
    const originValue = value.replace(/^!/, '')
    expr = `${
      isNegated ? '!' : ''
    }${compositedComponentApi}.props.data.${originValue}`
  } else {
    const isGlobal = value.startsWith('global.')
    const isCopositive = value.startsWith('comp-') || value.startsWith('$comp_')

    const PREFIX_MAP = {
      [PropBindType.state]: 'state',
      [PropBindType.computed]: 'computed',
      [PropBindType.dataVar]: 'dataVar',
      [PropBindType.stateData]: 'dataset.state',
      [PropBindType.paramData]: 'dataset.params',
    }
    switch (type) {
      case PropBindType.state:
      case PropBindType.computed:
      case PropBindType.dataVar:
      case PropBindType.stateData:
      case PropBindType.paramData: {
        if (isCopositive) {
          expr = value
            .replace(
              /^comp-\w+/,
              `${compositedComponentApi}.${PREFIX_MAP[type]}`
            )
            .replace(
              /^\$comp_\w+/,
              `${compositedComponentApi}.${PREFIX_MAP[type]}`
            )
        } else {
          expr = value
            .replace(
              /^\w+./,
              `${isGlobal ? 'app' : '$page'}.${PREFIX_MAP[type]}.`
            )
            .replace(
              /^comp-\w+/,
              `${compositedComponentApi}.${PREFIX_MAP[type]}`
            )
            .replace(
              /^\$comp_\w+/,
              `${compositedComponentApi}.${PREFIX_MAP[type]}`
            )
        }
      }
    }
  }
  return expr
}

export function createWidgetProps(
  widgets: { [key: string]: IWeAppComponentInstance },
  ctx: IBuildContext
) {
  const widgetProps = {}
  walkThroughWidgets(widgets, (id, widget, parentId) => {
    const { xComponent } = widget
    const xProps: typeof widget.xProps = widget.xProps || ({} as any)
    if (!xComponent) {
      // skip slot component
      return
    }
    const materialLib = ctx.materialLibs.find(
      (lib) => lib.name === xComponent.moduleName
    )
    if (!materialLib) {
      console.error('Component lib not found', xComponent)
      return
    }

    widgetProps[id] = extractWidgetProps(xProps as any)
    widgetProps[id]._parentId = parentId
    widgetProps[id]._order = widget.xIndex
    widgetProps[id].widgetType = xComponent.moduleName + ':' + xComponent.name
  })
  return widgetProps
}

export function createEventHanlders(
  widgets: { [key: string]: IWeAppComponentInstance },
  componentApi: string,
  ctx: IBuildContext
) {
  const eventHanlders = {}
  walkThroughWidgets(widgets, (id, widget, parentId) => {
    const { xComponent } = widget
    const xProps =
      widget.xProps || ({} as Required<IWeAppComponentInstance>['xProps'])
    if (!xComponent) {
      // skip slot component
      return
    }
    const materialLib = ctx.materialLibs.find(
      (lib) => lib.name === xComponent.moduleName
    )
    if (!materialLib) {
      console.error('Component lib not found', xComponent)
      return
    }
    const compProto = materialLib.components.find(
      (comp) => comp.name === xComponent.name
    )
    if (!compProto) {
      return
    }

    const listeners = (xProps.listeners || []).slice()
    // Generate form input value change builtin handler
    const { inputProps, syncProps } = compProto.meta || {}
    const syncConfigs = syncProps || inputProps || {}
    for (const valuProp in syncConfigs) {
      const config = syncConfigs[valuProp]
      const configs = Array.isArray(config) ? config : [config]
      configs.forEach(
        ({ changeEvent, valueFromEvent = 'event.detail.value' }) => {
          listeners.unshift({
            trigger: changeEvent,
            handler: {
              moduleName: '',
              // name: `({ event }) => { $page.widgets.${id}.${valuProp} = ${valueFromEvent} }`,
              name: `function({ event }) { mpCompToWidget(this, event.currentTarget).${valuProp} = ${valueFromEvent} }`,
            },
            type: ActionType.Inline,
            data: {},
          })
        }
      )
    }

    listeners.forEach((l) => {
      const handlerName = getMpEventHanlderName(id, l.trigger, l)
      eventHanlders[handlerName] = eventHanlders[handlerName] || []
      const params = generatedDynamicData(l.data)
      let handler = l.handler.name
      switch (l.type) {
        case ActionType.Platform: {
          handler = `function({data}){ return app.${l.handler.name}(data)}`
          break
        }
        case ActionType.Datasource: {
          handler = `function({data}){ return app.dataSources.$call({data})}`
          break
        }
        case ActionType.PropEvent: {
          handler = `function({event, data = {}}){ return ${componentApi}.props.events.${l.handler.name}({...event.detail, ...data}) }`
          break
        }
      }
      eventHanlders[handlerName].push({
        handler: handler,
        handlerModule: l.handler.moduleName,
        data: params.staticProps,
        boundData: params.boundProps,
        type: l.type,
      })
    })
  })
  return eventHanlders
}

export function createDataBinds(
  widgets: { [key: string]: IWeAppComponentInstance },
  ctx: IBuildContext
) {
  const dataBinds = {}
  walkThroughWidgets(widgets, (id, widget, parentId) => {
    const { xComponent } = widget
    const xProps =
      widget.xProps || ({} as Required<IWeAppComponentInstance>['xProps'])
    if (!xComponent) {
      // skip slot component
      return
    }
    const materialLib = ctx.materialLibs.find(
      (lib) => lib.name === xComponent.moduleName
    )
    if (!materialLib) {
      console.error('Component lib not found', xComponent)
      return
    }

    dataBinds[id] = {}

    Object.entries(xProps.data || {}).map(([prop, val]) =>
      setDataBind(dataBinds[id], prop, val)
    )

    // eslint-disable-next-line prefer-const
    const { directives = {} } = xProps
    setDataBind(dataBinds[id], '_waFor', directives.waFor as IDynamicValue)
    setDataBind(dataBinds[id], '_waIf', directives.waIf as IDynamicValue)

    setDataBind(dataBinds[id], 'classList', xProps.classListBind)
    setDataBind(dataBinds[id], 'style', xProps.styleBind)

    const { classList, style } = dataBinds[id]
    if (classList) {
      dataBinds[
        id
      ].classList = `concatClassList(${classList}, widgetProps.${id}.classList)`
    }
    if (style) {
      dataBinds[
        id
      ].style = `px2rpx({...widgetProps.${id}.style, ...(${style})})`
    }

    if (Object.keys(dataBinds[id]).length === 0) {
      delete dataBinds[id]
    }
  })
  return dataBinds
}

function setDataBind(target, prop: string, val: IDynamicValue) {
  if (val && val.type && val.type !== 'static') {
    const jsExpr = generateDataBind(val)
    if (jsExpr) {
      target[prop] = jsExpr
    }

    const propsKeepPropBindInJs = ['_waFor', '_waIf']
    if (
      val.type === PropBindType.prop &&
      propsKeepPropBindInJs.indexOf(prop) === -1
    ) {
      // Do not generate propBind since it's bound directly in wxml except for _waFor
      delete target[prop]
    }
  }
}
