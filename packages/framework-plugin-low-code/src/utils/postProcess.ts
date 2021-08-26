import fs from 'fs-extra';
import { merge } from 'lodash';
import path from 'path';
import { appTemplateDir } from '../builder/config';

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
