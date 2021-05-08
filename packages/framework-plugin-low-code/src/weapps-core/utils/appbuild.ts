import { CodingPublishType, IOutputs } from '../types/appbuild';

// 初始化版本
export const INIT_VERSION = '0.0.0';

// 支持1.0，1.0.0， 1.0.0.0
export const checkVersion = (value: string) => {
  return /^\d+\.\d+(\.\d+){0,2}$/.test(value);
};

export const biggerThanVersion = (value = '', lastVersion = '') => {
  const nowVersions = value
    .split('.')
    .map((item) => (Number.isNaN(parseInt(item)) ? 0 : parseInt(item)));
  const lastVersions = lastVersion
    .split('.')
    .map((item) => (Number.isNaN(parseInt(item)) ? 0 : parseInt(item)));
  const maxLen =
    nowVersions.length > lastVersion.length
      ? nowVersions.length
      : lastVersion.length;
  for (let i = 0; i < maxLen; i++) {
    const now = nowVersions[i] || 0;
    const last = lastVersions[i] || 0;
    if (now > last) {
      return true;
    } else if (now < last) {
      return false;
    }
  }
  return false;
};

export const getPublishAppId = (
  codingPublishType: CodingPublishType,
  outputs: IOutputs
) => {
  return codingPublishType === CodingPublishType.Android
    ? outputs.appid
    : codingPublishType === CodingPublishType.iOS
    ? outputs.iOSappId
    : 'main';
};
