import { ILowCodesModifyStatus, IWeAppData, ILockedPage } from '../types'
export function evalExpression(code: string, runtime: any) {
  try {
    return runtime.eval(`(function(forItems){const $for = forItems; return ${code};})`)
  } catch (e) {
    runtime.console.error(`Error in expression:\t${code}\n\n`, e)
  }
}

function findLowcodeItem(
  appData: IWeAppData,
  lowcodeDiff: ILowCodesModifyStatus
) {
  const pathKeys = lowcodeDiff.path.split('/')
  if (pathKeys[0] === 'global') {
    return appData.lowCodes.find((item) => item.path === lowcodeDiff.path)
  } else {
    const pageInstance: any = appData.pageInstanceList.find(
      (item) => item.id === pathKeys[0]
    )
    return pageInstance.lowCodes.find((item) => item.path === lowcodeDiff.path)
  }
}

export function receiveDataByLowcodeDiff(
  lastestAppData: IWeAppData,
  appSaveData: IWeAppData,
  allLowCodes: ILowCodesModifyStatus[],
  redisLockedPages: ILockedPage[],
  username: string
) {
  allLowCodes.forEach((lowcodeDiff) => {
    const cannotDel = redisLockedPages.find(
      (lockedPage) =>
        lockedPage.id === lowcodeDiff.path && username !== lockedPage.username
    )
    if (cannotDel) return
    const pathKeys = lowcodeDiff.path.split('/')
    let index = -1
    switch (lowcodeDiff.type) {
      case 'add':
      case 'mod':
        if (pathKeys[0] === 'global') {
          const lowcode = findLowcodeItem(appSaveData, lowcodeDiff)
          index = lastestAppData.lowCodes.findIndex(
            (item) => item.path === lowcodeDiff.path
          )
          if (index === -1) {
            lastestAppData.lowCodes.push(lowcode)
          } else {
            lastestAppData.lowCodes[index] = lowcode
          }
        } else {
          const lowcode = findLowcodeItem(appSaveData, lowcodeDiff)
          const pageInstance: any = lastestAppData.pageInstanceList.find(
            (item) => item.id === pathKeys[0]
          )
          index = pageInstance.lowCodes.findIndex(
            (item) => item.path === lowcodeDiff.path
          )
          if (index === -1) {
            pageInstance.lowCodes.push(lowcode)
          } else {
            pageInstance.lowCodes[index] = lowcode
          }
        }
        break
      case 'del':
        if (pathKeys[0] === 'global') {
          index = lastestAppData.lowCodes.findIndex(
            (item) => item.path === lowcodeDiff.path
          )
          index > -1 && lastestAppData.lowCodes.splice(index, 1)
        } else {
          const pageInstance: any = lastestAppData.pageInstanceList.find(
            (item) => item.id === pathKeys[0]
          )
          index = pageInstance.lowCodes.findIndex(
            (item) => item.path === lowcodeDiff.path
          )
          index > -1 && pageInstance.lowCodes.splice(index, 1)
        }
        break
    }
  })
}
