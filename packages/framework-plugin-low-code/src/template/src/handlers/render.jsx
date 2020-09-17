import React from 'react'
import { on } from './eventListener'
import { SchemaForm, FormEffectHooks } from '@formily/react-schema-renderer'
import { createFormActions } from '@formily/react-schema-renderer'
import { observer } from 'mobx-react-lite'
import { rendererFieldMiddleware } from './FieldMiddleware/renderer'
import { emitEvent } from './actionHandler/utils'
import { BaseActionTrigger } from '../../../weapps-core'
import { FormActionsContext } from './controller'
import { deepDealSchema } from './utils/common'

export class AppRender extends React.Component {
  FormActions = null

  constructor(props) {
    super(props)
    const { virtualFields, onFormActionsInit } = props

    this.FormActions = createFormActions()
    this.addMiddlewareVirtualFields = Object.keys(virtualFields).reduce((result, key) => {
      result[key] = observer(rendererFieldMiddleware(virtualFields[key]))
      return result
    }, {})
    this.componentSchema = deepDealSchema(this.props.componentSchema, (schema, key) => {
      schema.key = key
      schema.type = 'object'
    })

    onFormActionsInit && onFormActionsInit(this.FormActions)
  }

  componentWillMount() {
    const { pluginInstances = [] } = this.props

    pluginInstances.forEach(({ sourceKey, data, key }) => {
      sourceKey &&
        sourceKey({
          data,
          key,
          on,
        })
    })
  }

  addMiddlewareVirtualFields = {}

  render() {
    const { componentSchema } = this
    return (
      <FormActionsContext.Provider value={this.FormActions}>
        <SchemaForm
          className={this.props.className || ''}
          effects={() => {
            FormEffectHooks.onFormInit$().subscribe(formState => {
              this.emit(BaseActionTrigger.INIT, formState)
            })
            FormEffectHooks.onFieldValueChange$('*').subscribe(fieldState => {
              this.emit(BaseActionTrigger.FIELD_VALUE_CHANGE, fieldState)
            })
          }}
          actions={this.FormActions}
          schema={componentSchema}
          virtualFields={this.addMiddlewareVirtualFields}
        />
      </FormActionsContext.Provider>
    )
  }

  emit(trigger, customEventData) {
    emitEvent(trigger, this.props.pageListenerInstances, {
      customEventData, // Deprecated
      event: customEventData,
      FormActions: this.FormActions, // Deprecated
    })
  }
}
