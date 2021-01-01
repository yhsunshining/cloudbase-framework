export enum BaseActionTrigger {
  INIT = '__weapps_action_trigger_init',
  CLICK = '__weapps_action_trigger_click',
  MOUSE_ENTER = '__weapps_action_trigger_mouseEnter',
  MOUSE_LEAVE = '__weapps_action_trigger_mouseLeave',
  DOUBLE_CLICK = '__weapps_action_trigger_double_click',
  LONG_PRESS = '__weapps_action_trigger_long_press',
  ENTER_VIEW = '__weapps_action_trigger_enter_view',
  LEAVE_VIEW = '__weapps_action_trigger_leave_view',
  UNMOUNT = '__weapps_action_trigger_unmount',
  FIELD_VALUE_CHANGE = '__weapps_action_trigger_field_value_change',
}

export type ActionTrigger = BaseActionTrigger | 'string'

export enum ActionType {
  Rematch = 'rematch', // Rematch effect function
  Material = 'material', // Material actions
  GeneralFunc = 'general-func', // General lowcode functions
  LifeCycle = 'lifecycle', // 生命周期函数
  PropEvent = 'prop-event', // 属性事件。用于复合组件
  HandlerFn = 'handler-fn', // 低代码 handler 事件
  Inline = 'inline', // The handler name is js code
  Platform = 'platform', // 系统方式
  DataSource = 'dataSource'// 数据源方法
}
