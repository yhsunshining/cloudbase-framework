/**
 * https://developers.weixin.qq.com/miniprogram/dev/component/picker.html
 */
module.exports = {
    properties: [{
        name: 'headerText',
        get(domNode) {
            return domNode.getAttribute('header-text') || ''
        },
    }, {
        name: 'mode',
        get(domNode) {
            return domNode.getAttribute('mode') || 'selector'
        },
    }, {
        name: 'disabled',
        get(domNode) {
            return !!domNode.getAttribute('disabled')
        },
    }, {
        name: 'range',
        get(domNode) {
            if (domNode.tagName === 'SELECT') {
                return domNode.options.map(item => ({
                    label: item.label,
                    value: item.value,
                }))
            }

            let value = domNode.getAttribute('range')
            if (typeof value === 'string') {
                // react 会直接将属性值转成字符串
                try {
                    value = JSON.parse(value)
                } catch (err) {
                    value = value.split(',')
                }
            }
            return value !== undefined ? value : []
        },
    }, {
        name: 'rangeKey',
        get(domNode) {
            if (domNode.tagName === 'SELECT') return 'label'

            return domNode.getAttribute('range-key') || ''
        },
    }, {
        name: 'value',
        canBeUserChanged: true,
        get(domNode) {
            if (domNode.tagName === 'SELECT') return +domNode.selectedIndex || 0

            const mode = domNode.getAttribute('mode') || 'selector'
            let value = domNode.getAttribute('value')

            if (mode === 'selector') {
                return +value || 0
            } else if (mode === 'multiSelector') {
                if (typeof value === 'string') value = value.split(',').map(item => parseInt(item, 10)) // react 会直接将属性值转成字符串
                return value || []
            } else if (mode === 'time') {
                return value || ''
            } else if (mode === 'date') {
                return value || '0'
            } else if (mode === 'region') {
                if (typeof value === 'string') value = value.split(',') // react 会直接将属性值转成字符串
                return value || []
            }

            return value
        },
    }, {
        name: 'start',
        get(domNode) {
            return domNode.getAttribute('start') || ''
        },
    }, {
        name: 'end',
        get(domNode) {
            return domNode.getAttribute('end') || ''
        },
    }, {
        name: 'fields',
        get(domNode) {
            return domNode.getAttribute('fields') || 'day'
        },
    }, {
        name: 'customItem',
        get(domNode) {
            return domNode.getAttribute('custom-item') || ''
        }
    }],
    handles: {
        onPickerChange(evt) {
            const domNode = this.getDomNodeFromEvt(evt)
            if (!domNode) return

            let value = evt.detail.value

            // 可被用户行为改变的值，需要记录
            domNode._oldValues = domNode._oldValues || {}
            domNode._oldValues.value = value

            if (domNode.tagName === 'SELECT') {
                value = +value
                domNode.$$setAttributeWithoutUpdate('value', domNode.options[value] && domNode.options[value].value || '')
                domNode.$$setAttributeWithoutUpdate('selectedIndex', value)
                domNode.$$resetOptions()

                this.callEvent('change', evt)
            } else {
                domNode.$$setAttributeWithoutUpdate('value', value)

                this.callSingleEvent('change', evt)
            }
        },

        onPickerColumnChange(evt) {
            this.callSingleEvent('columnchange', evt)
        },

        onPickerCancel(evt) {
            this.callSingleEvent('cancel', evt)
        },
    },
}
