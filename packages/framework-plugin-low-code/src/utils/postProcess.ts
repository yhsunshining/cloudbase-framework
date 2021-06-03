import fs from 'fs-extra';
import { merge } from 'lodash';
import path from 'path';
import { buildAsAdminPortalByBuildType } from '../builder/types/common';
import { appTemplateDir } from '../builder/config';
import { DIST_PATH } from '../index';
import { DEPLOY_MODE } from '../types';

const RESET_ROUTERS_FUNCTION_NAME = 'lcap_reset_routers';

export function postprocessProjectConfig(projectJsonPath, data) {
  let projectJson = fs.readJsonSync(projectJsonPath);

  fs.writeJsonSync(projectJsonPath, merge(projectJson, data), { spaces: 2 });
}

export function postprocessDeployExtraJson(projectPath, deployOptions) {
  let { targetMpAppId, mpAppId } = deployOptions;
  if (targetMpAppId !== mpAppId) {
    let projectJson = fs.readJsonSync(
      path.resolve(projectPath, 'project.config.json')
    );
    const miniprogramRoot = projectJson?.miniprogramRoot || './';

    fs.writeFileSync(
      path.resolve(projectPath, miniprogramRoot, 'ext.json'),
      JSON.stringify(
        {
          extEnable: true,
          extAppid: targetMpAppId,
          directCommit: true,
        },
        null,
        2
      )
    );
  }
}

export async function postProcessCloudFunction(cloudFunctionRoot) {
  await fs.copy(
    path.join(appTemplateDir, 'cloud-functions/lcap_reset_routers'),
    path.join(cloudFunctionRoot, RESET_ROUTERS_FUNCTION_NAME)
  );
}

export function processCloudFunctionInputs(reletiveCloudFunctionRoot) {
  let functions = [
    {
      name: RESET_ROUTERS_FUNCTION_NAME,
      handler: 'index.main',
      timeout: 60,
      installDependency: true,
      runtime: 'Nodejs12.16',
      aclRule: { invoke: true },
    },
  ];
  if (functions.length) {
    return {
      functionRootPath: path.join(DIST_PATH, reletiveCloudFunctionRoot),
      functions,
      servicePaths: {},
    };
  }
  return;
}

export function processInstalledHook(plugin) {
  const { appId, buildTypeList, mainAppSerializeData, deployOptions } =
    plugin._resolvedInputs;
  if (buildAsAdminPortalByBuildType(buildTypeList)) {
    const isPreview = deployOptions?.mode === DEPLOY_MODE.PREVIEW;
    const id = isPreview ? `${appId}-preview` : appId;
    console.log('-------------------------', mainAppSerializeData);
    let name = mainAppSerializeData?.label || appId;
    name = isPreview ? `${name}-预览` : name;

    return {
      Config: {
        InstalledHook: [
          {
            FunctionName: RESET_ROUTERS_FUNCTION_NAME,
            Params: {
              id,
              name,
              deployPath: plugin._getWebRootPath(),
              pages: JSON.stringify(
                (mainAppSerializeData?.pageInstanceList || []).map((page) => ({
                  id: page.id,
                  title: page.data?.title?.value || page.id,
                  path: `/${page.id}`,
                }))
              ),
            },
          },
        ],
      },
    };
  }
  return {};
}
