const CloudBase = require('@cloudbase/manager-node');
const path = require('path');

// 云函数入口函数
exports.main = async (event, context) => {
  const envId = process.env.TCB_ENV || process.env.SCF_NAMESPACE;
  const manager = new CloudBase({
    envId,
  });

  const { id, name, deployUrl, deployPath } = event;
  let { pages } = event;
  if (typeof pages === 'string') {
    pages = JSON.parse(pages);
  }

  let CdnDomain = '';
  if (!deployUrl) {
    const { hosting } = manager;
    const hostingInfo = await hosting.getInfo();
    if (!hostingInfo[0]) {
      throw new Error(`环境${envId}未开通静态托管`);
    }
    CdnDomain = hostingInfo[0].CdnDomain;
  }

  const params = {
    ID: id,
    Name: name,
    EvnId: envId,
    DeployUrl: deployUrl || `https://${path.join(CdnDomain, deployPath)}`,
    Pages: pages.map((page) => ({
      ID: page.id,
      Title: page.title,
      Path: page.path,
    })),
  };

  try {
    const res = await manager.commonService('lowcode', '2021-01-08').call({
      Action: 'CreateRouter',
      Param: params,
    });
    console.log('request success', res);
  } catch (e) {
    console.log('request error', e);
  }

  return params;
};
