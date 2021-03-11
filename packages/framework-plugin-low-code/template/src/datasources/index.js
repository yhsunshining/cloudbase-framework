import {
  setConfig,
  initTcb,
  createDataSources,
} from '@cloudbase/weda-cloud-sdk/dist/h5'
export { 
  createDataset,
  createStateDataSourceVar,
  EXTRA_API,
  CLOUD_SDK,
  DS_API,
  DS_SDK,
  createDsSdk,
  createCloudSdk
} from '@cloudbase/weda-cloud-sdk/dist/h5'

import config from './config'

setConfig(config)
createDataSources(config.dataSourceProfiles)
initTcb()
