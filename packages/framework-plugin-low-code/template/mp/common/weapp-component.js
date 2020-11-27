import { observable, autorun } from 'mobx'
import { createEventHandlers, createComputed, touchObj, getDeep } from './util'
import { createInitData, resolveWidgetData, createWidgets, mpCompToWidget} from './widget'

export function createComponent(behaviors, properties, events, handler, dataBinds, evtListeners, widgetProps0, lifeCycle, stateFn, computedFuncs) {

  function createObservers(props){
    return props.reduce((observers, prop) => {
      observers[prop] = function(newVal) {
        <%= compApi %>.props.data[prop] = newVal
      }
      return observers
    }, {})
  }

  function createPropEvents(events, self) {
    const protectEventKeys = [
      'touchstart', //	手指触摸动作开始
      'touchmove', //		手指触摸后移动
      'touchcancel', //		手指触摸动作被打断，如来电提醒，弹窗
      'touchend', //		手指触摸动作结束
      'tap', //		手指触摸后马上离开
      'longpress', //		手指触摸后，超过350ms再离开，如果指定了事件回调函数并触发了这个事件，tap事件将不被触发	1.5.0
      'longtap', //		手指触摸后，超过350ms再离开（推荐使用longpress事件代替）
      'transitionend', //		会在 WXSS transition 或 wx.createAnimation 动画结束后触发
      'animationstart', //		会在一个 WXSS animation 动画开始时触发
      'animationiteration', //		会在一个 WXSS animation 一次迭代结束时触发
      'animationend', //		会在一个 WXSS animation 动画完成时触发
      'touchforcechange', // 在支持 3D Touch 的 iPhone 设备，重按时会触发
    ]
    const result = {}
    events.forEach(evt => {
      const isProtectKey = protectEventKeys.some(key => key === evt.name)
      if (isProtectKey) {
        result[evt.name] = function() {}
      } else {
        result[evt.name] = function(evtDetail) {
          if (evt.getValueFromEvent) {
            self.setData({value: evt.getValueFromEvent({detail: evtDetail})})
          }
          self.triggerEvent(evt.name, evtDetail)
        }
      }
    })
    return result
  }

  return {
    options: {
      virtualHost: true,
      multipleSlots: true,
      styleIsolation: 'shared',
    },
    behaviors: behaviors,
    // externalClasses: ['class'],
    properties: {
      id: {
        type: String
      },
      style: {
        type: String
      },
      className: {
        type: String,
      },
      ...properties,
    },

    data: createInitData(widgetProps0, dataBinds, '<%= dataPropNames.widgetProp %>'),

    lifetimes: {
      created() {
        const $comp = <%= compApi %> = {
          state: {},
          computed: {},
          widgets: {},
          props: {
            data: observable({}),
            events: createPropEvents(events, this),
            get style() { return $comp.node.style },
            get classList() { return $comp.node.classList },
          },
          handler: Object.keys(handler).reduce((result, key) => {
            result[key] = handler[key].bind(this)
            return result
          }, {}),
          node: null,
        }  // The weapps API for component, 'this' in component lowcode

        this._dataBinds = Object.keys(dataBinds).reduce((result, widgetId) => {
          result[widgetId] = Object.keys(dataBinds[widgetId]).reduce((result, prop) => {
            result[prop] = dataBinds[widgetId][prop].bind(this)
            return result
          }, {})
          return result
        }, {})

      },
      attached() {
        const owner = this.selectOwnerComponent()
        <%= compApi %>.node = mpCompToWidget(owner, this)

        const pageState = observable(stateFn.call(this))
        const pageComputed = createComputed(computedFuncs, this)

        <%= compApi %>.state = pageState
        <%= compApi %>.computed = pageComputed
        const widgetProps = createWidgets(widgetProps0, this._dataBinds, <%= compApi %>.widgets)

        const dataFactory = {
          // <%= dataPropNames.pageState %>: () => pageState,
          // <%= dataPropNames.pageComputed %>: () => pageComputed,
        }
        for (const id in widgetProps) {
          const props = widgetProps[id]
          dataFactory['<%= dataPropNames.widgetProp %>' + id] = () => resolveWidgetData(props)
        }

        this.createReactiveState(dataFactory)

        lifeCycle.onAttached && lifeCycle.onAttached.call(this)
      },
      ready() {
        lifeCycle.onReady && lifeCycle.onReady.call(this)
      },
      detached() {
        lifeCycle.onDetached && lifeCycle.onDetached.call(this)
      }
    },

    pageLifetimes: {},

    methods: {
      ...createEventHandlers(evtListeners),
      createReactiveState(dataFactory) {
        for (const k in dataFactory) {
          autorun(r => {
            this.requestRender({ [k]: dataFactory[k]() })
          })
        }
      },

      // setData merging
      pendingData: null,
      requestRender(data) {
        if (!this.pendingData) {
          this.pendingData = {}
          wx.nextTick(() => {
            const label = `Component(${<%= compApi %>.node.widgetType}-${this.id}) set data(${Object.keys(this.pendingData).join(',')})`
            <% if(debug) {%>console.time(label)<%} %>
            this.setData(this.pendingData, () => {
              <% if(debug) {%>console.timeEnd(label)<%} %>
            })
            this.pendingData = null
          })
        }
        touchObj(data)  // Touch all props to monitor data deeply, FIXME
        Object.assign(this.pendingData, data)
      },
      getWeAppInst() {
        return <%= compApi %>
      },
    },
    observers: createObservers(Object.keys(properties))
  }
}
