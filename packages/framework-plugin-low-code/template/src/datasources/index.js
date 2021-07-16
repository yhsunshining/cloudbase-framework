import {
  CLOUD_SDK,
  setConfig,
  initTcb,
} from '@cloudbase/weda-cloud-sdk/dist/h5';
import config from './config';

export {
  createDataset,
  createStateDataSourceVar,
  generateParamsParser,
  EXTRA_API,
  CLOUD_SDK,
  DS_API,
  DS_SDK,
} from '@cloudbase/weda-cloud-sdk/dist/h5';

CLOUD_SDK.setConfig({ wedaTarget: 'pre' });
setConfig(config);
initTcb();
