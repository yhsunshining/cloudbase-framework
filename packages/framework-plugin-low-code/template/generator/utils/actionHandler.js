import { resolveDataBinds } from './common';
import lodashSet from 'lodash.set';

const DEFAULT_MAX_TIMEOUT = 10 * 1000;

export function getMetaInfoBySourceKey(sourceKey) {
  const [materialName, name] = sourceKey.split(':');
  return {
    materialName,
    name,
  };
}

export async function emitEvent(
  trigger,
  listeners = [],
  args,
  scopeContext = {}
) {
  const targetListeners = listeners.filter((l) => l.trigger === trigger);
  for (const listener of targetListeners) {
    // 当前非捕获Event，再判断冒泡行为
    if (!args?.event?.detail?.isCapturePhase && listener.noPropagation) {
      args?.domEvent?.stopPropagation && args?.domEvent?.stopPropagation();
    }

    // 判断捕获的执行，只有执行的捕获与配置的捕获一致时。才会执行。
    if (
      (listener?.isCapturePhase || false) ===
      (args?.customEventData?.detail?.isCapturePhase || false)
    ) {
      try {
        const res = await invokeListener(listener, args, scopeContext);
        const eventName = `${listener.key}.success`;
        const event = {
          detail: {
            value: res,
            origin: args.event,
            isCapturePhase: !!args.event?.isCapturePhase,
          },
          name: eventName,
        };
        emitEvent(
          eventName,
          listeners,
          {
            ...args,
            event,
            customEventData: event,
          },
          scopeContext
        );
      } catch (e) {
        const eventName = `${listener.key}.fail`;
        const event = {
          detail: {
            value: e,
            origin: args.event,
            isCapturePhase: !!args.event?.isCapturePhase,
          },
          name: eventName,
        };
        emitEvent(
          eventName,
          listeners,
          {
            ...args,
            event,
            customEventData: event,
          },
          scopeContext
        );
        // 之前 invoke 内部catch 了错误，不会抛错
        // throw e
      }
    }
  }
}

function invokeListener(
  { instanceFunction, data = {}, dataBinds = {} },
  args,
  scopeContext
) {
  // ToDo resolve databinds
  const action = instanceFunction;
  const resolvedData = {
    ...data,
  };
  const resolvedDataBinds = resolveDataBinds(
    dataBinds,
    args.forItems,
    { event: args.event },
    scopeContext,
    true
  );

  // eslint-disable-next-line no-restricted-syntax
  for (const key in resolvedDataBinds) {
    if (
      resolvedDataBinds[key] &&
      resolvedDataBinds[key].__type === 'scopedValue'
    ) {
      try {
        lodashSet(
          resolvedData,
          key,
          resolvedDataBinds[key].getValue(scopeContext)
        );
      } catch (e) {
        lodashSet(resolvedData, key, '');
      }
    } else {
      lodashSet(resolvedData, key, resolvedDataBinds[key]);
    }
  }
  const params = {
    data: resolvedData,
    ...args,
  };

  return action(params);
}
