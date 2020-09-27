import * as React from 'react'
import { deleteComponentNode, setComponentNode } from '../componentNodeMap'
import { emitComponent } from '../eventListener'
import { getComponentId } from '../utils/common'
import { BaseActionTrigger } from '@govcloud/weapps-core'

const LONG_PRESS_TIMEOUT = 1000
const DOUBLE_CLICK_TIMEOUT = 200
const INTERSECTION_TIMEOUT = 500

export class ComponentActionHandler extends React.PureComponent {
  intersectionObserver = null

  containerRef = null

  longPressTimer = null

  preventClick = false

  doubleClickTimer = null

  intersectionTimer = null

  componentDidMount() {
    this.initIntersectionObserver()
    this.observeIntersection()
    // events.on(EventEmitTypes.COMPONENT_INTERSECTING_CHANGE, this.onComponentIntersectionChange)

    this.props.emit(BaseActionTrigger.INIT, {})
  }

  componentWillUnmount() {
    this.unobserveIntersection()
    // events.cancel(EventEmitTypes.COMPONENT_INTERSECTING_CHANGE, this.onComponentIntersectionChange)

    deleteComponentNode(this.props.schema.key)

    if (this.longPressTimer) {
      window.clearTimeout(this.longPressTimer)
    }
  }

  initIntersectionObserver = () => {
    if (process.env.isMiniprogram) {
      this.intersectionObserver = window.$$createIntersectionObserver()
    } else {
      this.intersectionObserver = new window.IntersectionObserver(entries => {
        entries.forEach(({ target, isIntersecting }) => {
          this.onComponentIntersectionChange({ isIntersecting }, target.getAttribute('data-key'))
        })
      })
    }
  }

  observeIntersection = () => {
    if (process.env.isMiniprogram) {
      setTimeout(() => {
        this.intersectionObserver
          .relativeTo('.h5-body')
          .observe(`.h5-body >>> #${getComponentId(this.props.schema.key)}`, res => {
            this.onComponentIntersectionChange(res, this.props.schema.key)
          })
      }, 0)
    } else {
      this.intersectionObserver.observe(this.containerRef)
    }
  }

  unobserveIntersection = () => {
    if (process.env.isMiniprogram) {
      this.intersectionObserver.disconnect()
    } else {
      this.intersectionObserver.unobserve(this.containerRef)
    }
  }

  onComponentIntersectionChange = (res, key) => {
    if (key !== this.props.schema.key) {
      return
    }

    const isIntersecting = res.isIntersecting || res.intersectionRatio > 0
    const trigger = isIntersecting ? BaseActionTrigger.ENTER_VIEW : BaseActionTrigger.LEAVE_VIEW
    this.props.emit(trigger, res)
  }

  onComponentPress = () => {
    this.longPressTimer = window.setTimeout(() => {
      this.props.emit(BaseActionTrigger.LONG_PRESS, {})
    }, LONG_PRESS_TIMEOUT)
  }

  onComponentPressRelease = () => {
    if (this.longPressTimer) {
      window.clearTimeout(this.longPressTimer)
    }
    this.longPressTimer = null
  }

  onSingleClick = event => {
    this.props.emit(BaseActionTrigger.CLICK, event)
  }

  onDoubleClick = evt => {
    if (this.doubleClickTimer) {
      clearTimeout(this.doubleClickTimer)
      this.doubleClickTimer = null
    }

    this.preventClick = true
    this.props.emit(BaseActionTrigger.DOUBLE_CLICK, evt)
    setTimeout(() => (this.preventClick = false), DOUBLE_CLICK_TIMEOUT)
  }

  emitComponentEvent = type => {
    const {
      props: { schema },
    } = this
    return emitComponent(type, schema)
  }

  withEmitComponentEvent = (type, handler) => res => {
    this.emitComponentEvent(type)
    if (handler) {
      return handler(res)
    }
  }

  setNode = node => {
    this.containerRef = node
    setComponentNode(this.props.schema.key, node)
  }

  render() {
    const { children, style, classNameList = [], schema } = this.props

    return (
      <div
        id={getComponentId(schema.key)}
        data-key={schema.key}
        className={`__weapps-component-actions-proxy ${classNameList.join(' ')}`}
        ref={this.setNode}
        style={style}
        onClick={this.onSingleClick}
        onDoubleClick={this.onDoubleClick}
        onTouchStart={this.onComponentPress}
        onTouchEnd={this.onComponentPressRelease}
        onMouseDown={this.onComponentPress}
        onMouseUp={this.onComponentPressRelease}
      >
        {children}
      </div>
    )
  }
}
