import { observable } from 'mobx'
import { createEventHandlers, createComputed } from './util'
import { createWidgets, mpCompToWidget } from './widget'
import mergeRenderer from './merge-renderer'

export function createComponent(behaviors, properties, events, handler, dataBinds, evtListeners, widgetProps, lifeCycle, stateFn, computedFuncs, config) {

  return Component({
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

    data: {},

    lifetimes: {
      created() {
        const $comp = this.$WEAPPS_COMP = {
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
        }  // The weapps API for component
      },
      attached() {
        const owner = this.selectOwnerComponent()
        const weappInstance = this.getWeAppInst()
        weappInstance.node = mpCompToWidget(owner, this)

        // Mount more APIs
        weappInstance.node.getDom = (fields) => {
          return rootWigdget.getDom(fields)
        }

        weappInstance.node.getConfig = () => config

        weappInstance.state = observable(stateFn.call(this))  // May depend on this.props.data.xxx
        weappInstance.computed = createComputed(computedFuncs, this)
        const widgets = createWidgets(widgetProps, dataBindsBindContext(dataBinds, this), weappInstance.widgets, this)
        const rootWigdget = widgets[Object.keys(widgetProps).find(id => !widgetProps[id]._parentId)]

        try {
          lifeCycle.onAttached && lifeCycle.onAttached.call(this)
        } catch (e) {
          console.error('Component lifecycle(attached) error', this.is, e)
        }

        this.initMergeRenderer(widgets)
      },
      ready() {
        lifeCycle.onReady && lifeCycle.onReady.call(this)
      },
      detached() {
        lifeCycle.onDetached && lifeCycle.onDetached.call(this)
      }
    },

    pageLifetimes: {
      show() {
        lifeCycle.onPageShow && lifeCycle.onPageShow.call(this)
      },
      hide() {
        lifeCycle.onPageHide && lifeCycle.onPageHide.call(this)
      },
      resize(size) {
        lifeCycle.onPageResize && lifeCycle.onPageResize.call(this, size)
      }
    },

    methods: {
      ...createEventHandlers(evtListeners),
      ...mergeRenderer,
      getWeAppInst() {
        return this.$WEAPPS_COMP
      },
    },
    observers: createObservers(Object.keys(properties))
  })
}

function createObservers(props) {
  return props.reduce((observers, prop) => {
    observers[prop] = function (newVal) {
      this.getWeAppInst().props.data[prop] = newVal
    }
    return observers
  }, {})
}

function dataBindsBindContext(dataBinds, self) {
  return Object.keys(dataBinds).reduce((result, widgetId) => {
    result[widgetId] = Object.keys(dataBinds[widgetId]).reduce((result, prop) => {
      result[prop] = dataBinds[widgetId][prop].bind(self)
      return result
    }, {})
    return result
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
      result[evt.name] = function () { }
    } else {
      result[evt.name] = function (evtDetail) {
        if (evt.getValueFromEvent) {
          self.setData({ value: evt.getValueFromEvent({ detail: evtDetail }) })
        }
        self.triggerEvent(evt.name, evtDetail)
      }
    }
  })
  return result
}
