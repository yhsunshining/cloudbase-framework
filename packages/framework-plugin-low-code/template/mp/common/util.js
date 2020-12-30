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
      const { lists, itemsById} = findForItemsOfWidget(mpCompToWidget(self, event.currentTarget)) || {}
      listeners.forEach(l => {
        let { data = {}, boundData = {} } = l
        data = { ...data }
        for (const k in boundData) {
          data[k] = boundData[k](lists, itemsById)
        }
        l.handler.call(self, { event, lists, forItems: itemsById, data })
      })
    }
  }
  return evtHandlers
}

export function getDeep(target, key, keySeparator = '.') {
  if (key == null) {
    return target
  }
  const keys = (key + '').split(keySeparator)
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

export function throttle(fn, limit) {
  let lastExecTime = 0
  let timer = null
  const throttled = function () {
    const idledDuration = Date.now() - lastExecTime
    if (idledDuration >= limit) {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      lastExecTime = Date.now()
      fn()
    } else if (!timer) {
     timer = setTimeout(throttled, limit - idledDuration)
    }
  }
  return throttled
}

export function deepEqual(a, b) {
  if (a === b) {
    return true
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false
    }
    for(let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])){
        return false
      }
    }
    return true
  }

  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const aProps = Object.keys(a), bProps = Object.keys(b)
    if (!deepEqual(aProps, bProps)) {
      return false
    }
    for(let i = 0; i < aProps.length; i++) {
      const prop = aProps[i]
      if (!deepEqual(a[prop], b[prop])) {
        return false
      }
    }
    return true
  }
  return false
}
