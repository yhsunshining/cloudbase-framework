import { inlineStyle, calPxToREM } from '../utils'

const noop = function () {}

export default class Modal {
  options = {
    title: '',
    content: '',
    showCancel: true,
    cancelText: '取消',
    cancelColor: '#000000',
    confirmText: '确定',
    confirmColor: '#3CC51F',
    success: noop,
    fail: noop,
    complete: noop
  }

  style = {
    maskStyle: {
      position: 'fixed',
      'z-index': '1000',
      top: '0',
      right: '0',
      left: '0',
      bottom: '0',
      background: 'rgba(0,0,0,0.6)'
    },
    modalStyle: {
      'z-index': '4999',
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '80%',
      'max-width': calPxToREM(300),
      'border-radius': calPxToREM(10),
      'text-align': 'center',
      'line-height': '1.6',
      overflow: 'hidden',
      background: '#FFFFFF'
    },
    titleStyle: {
      padding: `${calPxToREM(20)} ${calPxToREM(24)} ${calPxToREM(9)}`,
      'font-size': calPxToREM(18)
    },
    textStyle: {
      padding: `0 ${calPxToREM(24)} ${calPxToREM(12)}`,
      'min-height': calPxToREM(40),
      'font-size': calPxToREM(15),
      'line-height': '1.3',
      color: '#808080'
    },
    footStyle: {
      position: 'relative',
      'line-height': calPxToREM(48),
      'font-size': calPxToREM(18),
      display: 'flex'
    },
    btnStyle: {
      position: 'relative',
      '-webkit-box-flex': '1',
      '-webkit-flex': '1',
      flex: '1',
      'font-size': calPxToREM(16)
    }
  }

  create (options = {}) {
    // style
    const { maskStyle, modalStyle, titleStyle, textStyle, footStyle, btnStyle } = this.style

    // configuration
    const config = {
      ...this.options,
      ...options
    }

    // wrapper
    this.el = document.createElement('div')
    this.el.className = 'weapps__modal'
    this.el.style.position = 'relative'
    this.el.style.opacity = '0'
    this.el.style.transition = 'opacity 0.2s linear'
    this.el.style.zIndex = '999'

    // mask
    const mask = document.createElement('div')
    mask.setAttribute('style', inlineStyle(maskStyle))

    // modal
    const modal = document.createElement('div')
    modal.setAttribute('style', inlineStyle(modalStyle))

    // title
    const titleCSS = config.title ?
    {
      ...titleStyle,
      color: config.titleColor || titleStyle.color
    } : {
      ...titleStyle,
      display: 'none'
    }
    this.title = document.createElement('div')
    this.title.setAttribute('style', inlineStyle(titleCSS))
    this.title.textContent = config.title

    // text
    const textCSS = config.title ? {
      ...textStyle,
      color: config.contentColor || textStyle.color
    } : {
      ...textStyle,
      padding: `${calPxToREM(40)} ${calPxToREM(20)} ${calPxToREM(26)}`,
      color: config.contentColor ||'#353535'
    }
    this.text = document.createElement('div')
    this.text.setAttribute('style', inlineStyle(textCSS))
    this.text.textContent = config.content

    // foot
    const foot = document.createElement('div')
    foot.className = 'weapps-modal__foot'
    foot.setAttribute('style', inlineStyle(footStyle))

    // cancel button
    const cancelCSS = {
      ...btnStyle,
      color: config.cancelColor,
      display: config.showCancel ? 'block' : 'none'
    }
    this.cancel = document.createElement('div')
    this.cancel.className = 'weapps-model__btn'
    this.cancel.setAttribute('style', inlineStyle(cancelCSS))
    this.cancel.textContent = config.cancelText
    this.cancel.onclick = () => {
      this.hide()
      const res = this.getRes('cancel')
      config.success(res)
      config.complete(res)
      this.resolveHandler(res)
    }

    // confirm button
    this.confirm = document.createElement('div')
    this.confirm.className = 'weapps-model__btn'
    this.confirm.setAttribute('style', inlineStyle(btnStyle))
    this.confirm.style.color = config.confirmColor
    this.confirm.textContent = config.confirmText
    this.confirm.onclick = () => {
      this.hide()
      const res = this.getRes('confirm')
      config.success(res)
      config.complete(res)
      this.resolveHandler(res)
    }

    // result
    foot.appendChild(this.cancel)
    foot.appendChild(this.confirm)
    modal.appendChild(this.title)
    modal.appendChild(this.text)
    modal.appendChild(foot)
    this.el.appendChild(mask)
    this.el.appendChild(modal)

    // show immediately
    document.body.appendChild(this.el)
    setTimeout(() => { this.el.style.opacity = '1' }, 0)

    return new Promise(resolve => (this.resolveHandler = resolve))
  }

  getRes (type) {
    const res = {
      errMsg: 'showModal:ok',
      cancel: false,
      confirm: false
    }
    res[type] = true
    return res
  }

  show (options = {}) {
    const config = {
      ...this.options,
      ...options
    }

    if (this.hideOpacityTimer) clearTimeout(this.hideOpacityTimer)
    if (this.hideDisplayTimer) clearTimeout(this.hideDisplayTimer)

    // title & text
    const { textStyle, titleStyle } = this.style
    let textCSS
    if (config.title) {
      this.title.textContent = config.title
      // none => block
      this.title.style.display = 'block'
      const titleCSS = {
        ...titleStyle,
        color: config.titleColor || titleStyle.color || ''
      }
      this.title.setAttribute('style', inlineStyle(titleCSS))
      const textCss = {
        ...textStyle,
        color: config.contentColor || titleStyle.color || ''
      }

      this.text.setAttribute('style', inlineStyle(textCss))
    } else {
      // block => none
      this.title.style.display = 'none'
      textCSS = {
        ...textStyle,
        padding: `${calPxToREM(40)} ${calPxToREM(20)} ${calPxToREM(26)}`,
        color: config.contentColor || '#353535'
      }
      this.text.setAttribute('style', inlineStyle(textCSS))
    }

    this.text.textContent = config.content || ''

    // showCancel
    this.cancel.style.display = config.showCancel ? 'block' : 'none'

    // cancelText
    this.cancel.textContent = config.cancelText || ''

    // cancelColor
    this.cancel.style.color = config.cancelColor || undefined

    // confirmText
    this.confirm.textContent = config.confirmText || ''

    // confirmColor
    this.confirm.style.color = config.confirmColor || undefined

    // cbs
    this.cancel.onclick = () => {
      this.hide()
      const res = this.getRes('cancel')
      config.success(res)
      config.complete(res)
      this.resolveHandler(res)
    }
    this.confirm.onclick = () => {
      this.hide()
      const res = this.getRes('confirm')
      config.success(res)
      config.complete(res)
      this.resolveHandler(res)
    }

    // show
    this.el.style.display = 'block'
    setTimeout(() => { this.el.style.opacity = '1' }, 0)

    return new Promise(resolve => (this.resolveHandler = resolve))
  }

  hide () {
    if (this.hideOpacityTimer) clearTimeout(this.hideOpacityTimer)
    if (this.hideDisplayTimer) clearTimeout(this.hideDisplayTimer)

    this.hideOpacityTimer = setTimeout(() => {
      this.el.style.opacity = '0'
      this.hideDisplayTimer = setTimeout(() => { this.el.style.display = 'none' }, 200)
    }, 0)
  }
}
