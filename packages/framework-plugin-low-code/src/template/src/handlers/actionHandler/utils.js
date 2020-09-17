import { timeout } from 'promise-timeout'
import { resolveDataBinds } from '../utils/common'

const DEFAULT_MAX_TIMEOUT = 10 * 1000

export function getMetaInfoBySourceKey(sourceKey) {
  const [materialName, name] = sourceKey.split(':')
  return {
    materialName,
    name,
  }
}

export async function emitEvent(trigger, listeners = [], args) {
  const targetListeners = listeners.filter(l => l.trigger === trigger)
  for (const listener of targetListeners) {
    await invokeListener(listener, args)
  }
}

async function invokeListener({ instanceFunction, data = {}, dataBinds = {} }, args) {
  // ToDo resolve databinds
  const action = instanceFunction
  const maxTimeout = DEFAULT_MAX_TIMEOUT
  const params = {
    data: { ...data, ...resolveDataBinds(dataBinds, args.forItems) },
    ...args,
  }

  try {
    if (maxTimeout === 'Infinity') {
      await action(params)
    } else {
      const p = action(params)
      if (p instanceof Promise) {
        await timeout(p, maxTimeout)
      }
    }
  } catch (e) {
    console.error('Action error: ', e)
  }
}
