import * as path from 'path';
import fs from 'fs-extra';
import { IWebRuntimeAppData } from '../../weapps-core/index';
import { copy } from 'fs-extra';
import chalk from 'chalk';
import { copyEntryFile } from '../service/builder/copy';
import { appTemplateDir } from '../config';

export async function runCopy(
  appBuildDir: string,
  webRuntimeAppData: IWebRuntimeAppData,
  options: { adminPortalKey: string }
) {
  const timeTag = '-------------------- runCopy ';
  console.time(timeTag);
  const srcFiles = [
    'src/index.less',
    'src/handlers',
    'src/utils',
    'html',
    'webpack',
    'src/libraries',
  ];
  console.log(chalk.blue.bold('Copying files:'));
  for (const entry of srcFiles) {
    const dstFile = path.join(appBuildDir, entry);
    console.log(dstFile);
    await copy(path.join(appTemplateDir, entry), dstFile);
  }
  await copyEntryFile(appBuildDir, webRuntimeAppData, options.adminPortalKey);
  // fs.writeFileSync(
  //   path.join(appBuildDir, 'mainAppData.json'),
  //   JSON.stringify(webRuntimeAppData, null, 2)
  // )
  console.timeEnd(timeTag);
}
