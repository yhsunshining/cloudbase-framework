import { setConfig, initTcb, CLOUD_SDK } from '@cloudbase/weda-cloud-sdk/dist/h5';
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

setConfig(config);
initTcb();
