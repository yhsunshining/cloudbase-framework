import * as React from "react";
import { observer } from "mobx-react-lite";
import { observable, autorun, reaction, runInAction } from "mobx";
import { AppRender } from "/src/handlers/RenderWrapper";
import { createWidgets, retryDataBinds, WidgetsContext, bindFuncObj, createComputed, resolveComponentProps} from '/src/utils/index'
import getStateFn from "./lowcode/state.js";
import computed from "./lowcode/computed.js";
import lifecycle from "./lowcode/lifecycle.js";
// import i18n from '@tcwd/weapps-sdk/lib/i18n'
<% if(isSandbox) { %>
import { ErrorBoundary } from 'react-error-boundary'
import { createErrorFallback } from '/src/utils/error'
<% } %>
import componentAPI from './lowcode/index';
import get from 'lodash.get'

<% handlersImports.forEach(handler => { %>
import handler$<%= handler.name %> from "./lowcode/handler/<%= handler.name %>.js";
<% }) %>

// Import Components outof sandbox
<% useComponents.forEach(compItem => {%>
<% if(!isSandbox && compItem.isComposite){ %>
import <%= compItem.var %> from "/src/libraries/<%= compItem.moduleName %>@<%= compItem.version %>/components/<%= compItem.name %>";
<% } else if(!isSandbox) { %>
const <%= compItem.var %> = window["@weapps-materials-main-<%= compItem.moduleName %>"].components["<%= compItem.name %>"];
<% } %>
<%}) %>

import * as constObj from '../../libCommonRes/const'
import * as toolsObj from '../../libCommonRes/tools'

import "./lowcode/style.css";

const libCode = '<%= materialName %>'

class CompositeCompWrapper extends React.Component {

  $WEAPPS_COMP = {}

  componentDidUpdate() {
    runInAction(() => {
      const { data } = this.props
      for(let prop in data) {
        // 更新 propsData
        if (typeof data[prop] !== 'function') {
          this.propsData[prop] = data[prop]
        }
      }
    })
  }


  constructor(props) {
    super(props);

    this.compConfig = <%= JSON.stringify(compConfig, null, 2) %>

    // Import Components in sandbox
    <% useComponents.forEach(compItem => {%>
    <% if(isSandbox){ %>
    const <%= compItem.var %> = window["@weapps-materials-main-<%= compItem.moduleName %>"].components["<%= compItem.name %>"];
    <% } %>
    <%}) %>

    this.virtualFields = Object.assign({}, props.pageVirtualFields || {}, {
    <% useComponents.forEach(compItem => {%>
      "<%= compItem.key %>": <% if(compItem.isPlainProps) {%> (props) => <<%= compItem.var %> {...resolveComponentProps(props, 1)} /> <% } else {%> <<%= compItem.var %>{...resolveComponentProps(props, 0)} />  <% }%>,
    <%}) %>
    });

    // 挂载给到 $comp.props.events 使用
    this.events = (<%= emitEvents %>).reduce((obj, trigger) => {
      obj[trigger] = (eventData, domEvent) => {
        this.props.emit(trigger, eventData, domEvent);
        this.node._listeners && this.node._listeners.emit(trigger, eventData, domEvent)
      };
      return obj;
    }, {});
    this.handler = this.$WEAPPS_COMP.handler = {
      <% handlersImports.forEach(handler => { %>
      <%= handler.name %>: handler$<%= handler.name %>.bind(this),
      <% }) %>
    };
    const widgetContext = <%= widgets %>
    const dataBinds = this._dataBinds = <%= dataBinds %>
    this.componentSchema = <%= componentSchema %>;

    const defaultProps = <%= JSON.stringify(defaultProps, null, 2) %>
    this.propsData = observable(Object.assign({}, defaultProps, this.props.data || {}))
    this.$WEAPPS_COMP.lib = { const: constObj, tools: toolsObj }
    /*
    this.i18n = this.$WEAPPS_COMP.i18n = {
      ...i18n,
      t (key, data) {
        return i18n.t(libCode + ':' + key, data)
      },
    }
    */
    this.$WEAPPS_COMP.props = { ...this.props, events: this.events, data: this.propsData }

    this.state = this.$WEAPPS_COMP.state = observable(getStateFn.bind(this)())
    this.computed = this.$WEAPPS_COMP.computed = createComputed(computed, this)
    this.node = this.$WEAPPS_COMP.node = this.createWidgetNode(this) || {}
    this.initPublicMethods()

    this.widgets = this.$WEAPPS_COMP.widgets = createWidgets(widgetContext, dataBinds)
    // widgets 内的 dataBinds 可能需要关联 widgets，需要重新执行 dataBinds
    retryDataBinds()
    Object.keys(this.widgets || {}).forEach(widgetId => {
      // 将实例 ownerWidget 挂到内部组件上。内部组件就可以通过 $comp.node.ownerWidget 获取到所在的组件实例
      const node = this.widgets[widgetId]
      if (Array.isArray(node)) {
        node.forEach(item => {
          item.ownerWidget = this.node;
          item.getOwnerWidget = () => this.node;
        })
      }
      else {
        node.ownerWidget = this.node
        node.getOwnerWidget = () => this.node
      }
      // this.widgets[widgetId].ownerWidget = this.node
      // this.widgets[widgetId].getOwnerWidget = () => this.node
    })

    this.pageListenerInstances = [];
    this.createCompAPI(this)
  }

  // publicMthods 挂载内部，使用 $comp.api。挂载到外部使用 $comp.node.api
  initPublicMethods() {
    const publicMethods = componentAPI.publicMethods || {}
    Object.keys(publicMethods).map(fnName => {
      const bindFunc = publicMethods[fnName].bind(this)
      this[fnName] = bindFunc
      this.$WEAPPS_COMP[fnName] = bindFunc
      if(this.node) this.node[fnName] = bindFunc
    })
  }

  // 创建自身节点
  createWidgetNode(compThis) {
    // 当为数组时，需要判断自己属于 widgets 的哪一项
    const {
      compositeParent,
      forIndexes,
      id
    } = compThis.props
    let widgetData = compositeParent.$WEAPPS_COMP
      ? compositeParent.$WEAPPS_COMP.widgets[id]
      : compositeParent.$page.widgets[id]
    if(Array.isArray(widgetData)) {
      widgetData = widgetData.length > 0 ? get(widgetData, forIndexes) : {}
    }
    widgetData = widgetData || {}
    Object.assign(widgetData, {
      getConfig: () => compThis.compConfig,
    }, bindFuncObj(componentAPI.publicMethods || {}, compThis)
    )

    return widgetData
  }

  createCompAPI(compThis) {
    compThis.$WEAPPS_COMP = {
      _dataBinds: compThis._dataBinds,
      compConfig: compThis.compConfig,
      widgets: compThis.widgets,
      node: compThis.node,
      handler: compThis.handler,
      lib: { const: constObj, tools: toolsObj },
      // i18n: compThis.i18n,
      get props() {
        return {...compThis.props, events: compThis.events, data: compThis.propsData }
      },
      get state() {
        return compThis.state
      },
      get computed() {
        return compThis.computed
      },
    };
  }

  initWatchMethods() {
    const { watch = {}, watchState = {}, watchWidget = {}, watchEffects = {}} = componentAPI
    const _this = this
    const weappInst = _this.$WEAPPS_COMP

    // # watch effect
    this.watchEffectDisposers = Object.keys(watchEffects).map(fnName => {
      return autorun(watchEffects[fnName].bind(this))
    })
    const disposers = this.watchEffectDisposers

    // # watch props
    Object.keys(watch).map(key => runWatcher(parseWatcher(watch[key]), weappInst.props.data, key, 'watch'))

    // # watch state
    Object.keys(watchState).map(key => runWatcher(parseWatcher(watchState[key]), weappInst.state, key, 'watchState'))

    // # watch widgets
    Object.keys(watchWidget).map(key => runWatcher(parseWatcher(watchWidget[key]), weappInst.widgets, key, 'watchWidgets'))

    function runWatcher({ handler, immediate } = {}, target, key, label) {
      if (!handler) {
        console.error(`Invalid ${label}(${key}) of ${weappInst.node.widgetType}, watch must a function or {handler: function}`)
        return
      }
      const disposer = reaction(() => get(target, key), handler.bind(_this), { fireImmediately: immediate })
      disposers.push(disposer)
    }
  }

  componentDidMount() {
    this.initPublicMethods()
    this.initWatchMethods()

    lifecycle.onAttached && lifecycle.onAttached.bind(this)()
    lifecycle.onReady && lifecycle.onReady.bind(this)()
  }

  componentWillUnmount() {
    if(this.watchEffectDisposers) {
      this.watchEffectDisposers.forEach(disposer => disposer())
      this.watchEffectDisposers = null
    }
    this.node._listeners && this.node._listeners.clear()
    lifecycle.onDetached && lifecycle.onDetached.bind(this)()
  }

  render() {
    return (
      <WidgetsContext.Provider value={{ parent: this }}>
        <AppRender
          className={this.props.className}
          virtualFields={this.virtualFields}
          componentSchema={this.componentSchema}
          codeContext={this}
        />
      </WidgetsContext.Provider>
    );
  }
}

CompositeCompWrapper.contextType = WidgetsContext

export default observer((props) => (
  <% if(isSandbox) { %>
  <ErrorBoundary FallbackComponent={createErrorFallback('<%= name %>', '<%= id %>')}>
  <% } %>
    <CompositeCompWrapper {...props}></CompositeCompWrapper>
  <% if(isSandbox) { %>
  </ErrorBoundary>
  <% } %>
));

function parseWatcher(watcher) {
  if (!watcher) return
  if (watcher instanceof Function) {
    return { handler: watcher, immediate: false }
  }
  const { handler, immediate = false } = watcher
  if (!(handler instanceof Function)) return
  return { handler, immediate }
}
