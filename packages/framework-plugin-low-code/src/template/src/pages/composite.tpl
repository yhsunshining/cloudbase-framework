import React from "react";
import { observer } from "mobx-react-lite";
import { observable } from "mobx";

import { AppRender } from "../../../../handlers/render";
import { createComputed } from "../../../../utils";

import getStateFn from "lowcode/composite/<%= name %>_<%= id %>/state.js";
import computed from "lowcode/composite/<%= name %>_<%= id %>/computed.js";
import lifecycle from "lowcode/composite/<%= name %>_<%= id %>/lifecycle.js";

<% handlersImports.forEach(handler => { %>
import handler$<%= handler.name %> from "lowcode/composite/<%= name %>_<%= id %>/handler/<%= handler.name %>.js";
<% }) %>

// Import Components
<% useComponents.forEach(compItem => {%>
import <%= compItem.var %> from "libraries/<%= compItem.moduleName %>@<%= compItem.version %>/components/<%= compItem.name %>";
<%}) %>

import "lowcode/composite/<%= name %>_<%= id %>/style.less";

const pluginInstances = [];

class CompositeCompWrapper extends React.Component {
  constructor(props) {
    super(props);

    this.virtualFields = Object.assign({}, props.pageVirtualFields || {}, {
    <% useComponents.forEach(compItem => {%>
      "<%= compItem.key %>": <%= compItem.var %>,
    <%}) %>
    });

    this.$WEAPPS_COMP = this;

    this.propsEvents = {};
    (props.listenerInstances || []).forEach((lItem) => {
      this.propsEvents[lItem.trigger] = (params) => {
        this.props.emit(lItem.trigger, {detail: params, name: lItem.trigger})
      };
    });

    this.state = observable(getStateFn.bind(this)());

    this.computed = createComputed(computed, this);

    this.handler = {
      <% handlersImports.forEach(handler => { %>
      <%= handler.name %>: handler$<%= handler.name %>.bind(this),
      <% }) %>
    };

    this.componentSchema = <%= componentSchema %>;

    this.pageListenerInstances = <%= pageListenerInstances %>;
  }

  componentDidMount() {
    lifecycle.onAttached && lifecycle.onAttached.bind(this)()
  }

  componentWillUnmount() {
    lifecycle.onDetached && lifecycle.onDetached.bind(this)()
  }

  render() {
    this.props.events = this.propsEvents
    return (
      <AppRender
        className="<%= name %>_<%= id %>"
        onFormActionsInit={formActions => this.actions = formActions}
        pageListenerInstances={this.pageListenerInstances}
        virtualFields={this.virtualFields}
        componentSchema={this.componentSchema}
        pluginInstances={pluginInstances}
      />
    );
  }
}

export default observer((props) => (
  <CompositeCompWrapper {...props}></CompositeCompWrapper>
));
