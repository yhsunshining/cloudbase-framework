export { TCBError } from './utils'
import { setConfig } from './utils'
export { createDataVar, buildDataVarFetchFn } from './datavar'
export { dataSources, createDataSource } from './datasources'

setConfig({
  envID: '<%= envId %>' || undefined
})
