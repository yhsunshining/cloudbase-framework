import { findForItemsOfWidget, mpCompToWidget } from './widget'

/**
 * Convert abcWordSnd -> abc-word-snd
 */
export function toDash(str) {
  return str.replace(/[A-Z]/g, upperLetter => `-${upperLetter.toLowerCase()}`)
}

export function createComputed(funcs, bindContext = null) {
  const computed = {}
  for (const name in funcs) {
    Object.defineProperty(computed, name, {
      get() {
        try {
          return bindContext ? funcs[name].call(bindContext) : funcs[name]()
        } catch (e) {
          console.error('Computed error', e)
        }
      },
      enumerable: true
    })
  }
  return computed
}

export function createEventHandlers(evtListeners) {
  const evtHandlers = {}
  for (const name in evtListeners) {
    const listeners = evtListeners[name]
    evtHandlers[name] = function (event) {
      const self = this
      // The page event handler
      const forItems = findForItemsOfWidget(mpCompToWidget(self, event.currentTarget))
      listeners.forEach(l => {
        let { data = {}, boundData = {} } = l
        data = { ...data }
        for (const k in boundData) {
          data[k] = boundData[k](forItems)
        }
        l.handler.call(self, { event, forItems, data })
      })
    }
  }
  return evtHandlers
}

const varSeparator = '.'

export function getDeep(target, key) {
  if (key == null) {
    return target
  }
  const keys = (key + '').split(varSeparator)
  let prop = target[keys[0]]
  for (let i = 1; i < keys.length; i++) {
    prop = prop[keys[i]]
  }
  return prop
}

/**
 * Touch all props of given object deeply
 */
export function touchObj(obj) {
  if (!obj) {
    return
  }
  if (typeof obj === 'string') {
    return
  }
  if (Array.isArray(obj)) {
    obj.forEach(touchObj)
  } else if (obj) {
    Object.keys(obj).forEach(key => touchObj(obj[key]))
  }
}
