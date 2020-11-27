import * as React from "react";
import { observer } from "mobx-react-lite";
import { observable } from "mobx";

import { AppRender } from "handlers/render";
import { createComputed } from "../../../../utils";
import { createWidgets, retryDataBinds } from 'handlers/utils'
import { get } from 'lodash'
import getStateFn from "./lowcode/state.js";
import computed from "./lowcode/computed.js";
import lifecycle from "./lowcode/lifecycle.js";
import { app, $page } from '../../../../app/global-api'

<% handlersImports.forEach(handler => { %>
import handler$<%= handler.name %> from "./lowcode/handler/<%= handler.name %>.js";
<% }) %>

// Import Components
<% useComponents.forEach(compItem => {%>
import <%= compItem.var %> from "libraries/<%= compItem.moduleName %>@<%= compItem.version %>/components/<%= compItem.name %>";
<%}) %>

import "./lowcode/style.less";

const pluginInstances = [];

class CompositeCompWrapper extends React.Component {

  $WEAPPS_COMP = {}

  componentDidUpdate() {
    const { data } = this.props
    for(let prop in data) {
      // 更新 propsData
      this.propsData[prop] = data[prop]
    }
  }


  constructor(props) {
    super(props);

    this.virtualFields = Object.assign({}, props.pageVirtualFields || {}, {
    <% useComponents.forEach(compItem => {%>
      "<%= compItem.key %>": <%= compItem.var %>,
    <%}) %>
    });
    this.events = (<%= emitEvents %>).reduce((obj, trigger) => {
      obj[trigger] = (event) => {
        this.props.emit(trigger, event)
      };
      return obj
    }, {});
    this.handler = this.$WEAPPS_COMP.handler = {
      <% handlersImports.forEach(handler => { %>
      <%= handler.name %>: handler$<%= handler.name %>.bind(this),
      <% }) %>
    };
    this.componentSchema = <%= componentSchema %>;
    const widgetContext = <%= widgets %>
    const dataBinds = <%= dataBinds %>
    const defaultProps = <%= JSON.stringify(defaultProps, null, 2) %>
    this.propsData = observable(Object.assign({}, defaultProps, this.props.data || {}))
    this.$WEAPPS_COMP.props = { ...this.props, events: this.events, data: this.propsData }
    this.state = this.$WEAPPS_COMP.state = observable(getStateFn.bind(this)())
    this.computed = this.$WEAPPS_COMP.computed = createComputed(computed, this)
    this.node = this.$WEAPPS_COMP.node = this.createWidgetNode(this)
    this.widgets = createWidgets(widgetContext, dataBinds)
    // widgets 内的 dataBinds 可能需要关联 widgets，需要重新执行 dataBinds
    retryDataBinds()
    this.pageListenerInstances = [];
    this.createCompAPI(this)
  }

  createWidgetNode(compThis) {
    // 当为数组时，需要判断自己属于 widgets 的哪一项
    const {
      compositeParent,
      forIndexes,
      id
    } = compThis.props
    const widgetData = compositeParent
      ? compositeParent.$WEAPPS_COMP.widgets[id]
      : $page.widgets[id]
    if(Array.isArray(widgetData)) {
      return widgetData.length > 0 ? get(widgetData, forIndexes) : {}
    } else {
      return widgetData
    }
  }

  createCompAPI(compThis) {
    compThis.$WEAPPS_COMP = {
      widgets: compThis.widgets,
      node: compThis.node,
      handler: compThis.handler,
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

  componentDidMount() {
    lifecycle.onAttached && lifecycle.onAttached.bind(this)()
    lifecycle.onReady && lifecycle.onReady.bind(this)()
  }

  componentWillUnmount() {
    lifecycle.onDetached && lifecycle.onDetached.bind(this)()
  }

  render() {
    return (
      <AppRender
        className={this.props.className}
        virtualFields={this.virtualFields}
        componentSchema={this.componentSchema}
        codeContext={this}
      />
    );
  }
}

export default observer((props) => (
  <CompositeCompWrapper {...props}></CompositeCompWrapper>
));
