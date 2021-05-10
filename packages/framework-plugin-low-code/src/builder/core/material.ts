import * as fs from 'fs';
import * as path from 'path';
import _ from 'lodash';
import { IMaterialItem } from '../../weapps-core';
import { downloadAndInstallDependencies } from '../service/builder/webpack';
import {
  copyMaterialLibraries,
  genCompositeComponentLibraries,
} from '../service/builder/copy';
import { writeLowCodeFilesForCompositeComp } from '../service/builder/generate';
import { getComponentsInfo } from '../util';
import { RUNTIME } from '../../types';
import * as junk from '../util/junk';

export async function runHandleMaterial(
  appBuildDir: string,
  dependencies: IMaterialItem[] = [],
  materialsDir: string,
  runtime: RUNTIME = RUNTIME.NONE,
  ignoreInstall: boolean = false
) {
  const allMaterials = [
    await handleNormalMaterial({
      dependencies,
      materialsDir,
      appBuildDir,
      runtime,
      ignoreInstall,
    }),
    await handleCompositeComponent({ dependencies, appBuildDir }),
  ];
  return _.flatten(allMaterials);
}

async function handleNormalMaterial({
  dependencies,
  materialsDir,
  appBuildDir,
  runtime,
  ignoreInstall,
}) {
  const timeTag = '-------------------- handleNormalMaterial';
  console.time(timeTag);
  const normalDependencies = dependencies.filter((item) => !item.isComposite);
  // await createNodeModulesSoftLink(appBuildDir, nodeModulesPath)
  await downloadAndInstallDependencies(normalDependencies, materialsDir, {
    runtime,
    ignoreInstall,
  });
  await copyMaterialLibraries(normalDependencies, materialsDir, appBuildDir);
  console.timeEnd(timeTag);
  return normalDependencies.map((metaInfo) => {
    const materialItemPath = path.join(
      appBuildDir,
      'src/libraries',
      `${metaInfo.name}@${metaInfo.version}`
    );
    const actionsDir = path.join(materialItemPath, 'actions');
    return {
      ...metaInfo,
      actions:
        fs.existsSync(actionsDir) &&
        fs
          .readdirSync(actionsDir)
          .filter(junk.not)
          .map((dirName) => ({ name: dirName })),
      components: fs
        .readdirSync(path.join(materialItemPath, 'components'))
        .filter(junk.not)
        .map((dirName) => ({ name: dirName })),
      plugins: [],
    };
  });
}

async function handleCompositeComponent({ dependencies, appBuildDir }) {
  console.time('handleCompositeComponent');
  const compositeDependencies: IMaterialItem[] = dependencies.filter(
    (item) => item.isComposite
  );

  const materialGroupInfoMap = {};
  dependencies.forEach(
    (item) =>
      (materialGroupInfoMap[item.name] = {
        isComposite: item.isComposite,
        version: item.version,
        entry: item.entry,
        schemaVersion: item.schemaVersion,
      })
  );
  const componentsMeta = await getComponentsInfo(
    path.join(appBuildDir, 'src'),
    dependencies
  );

  await writeLowCodeFilesForCompositeComp(compositeDependencies, appBuildDir);
  await genCompositeComponentLibraries(
    compositeDependencies,
    appBuildDir,
    materialGroupInfoMap,
    componentsMeta
  );

  console.timeEnd('handleCompositeComponent');
  const result = compositeDependencies.map((metaInfo) => {
    const materialItemPath = path.join(
      appBuildDir,
      'src/libraries',
      `${metaInfo.name}@${metaInfo.version}`
    );
    return {
      ...metaInfo,
      components:
        metaInfo.components.length === 0
          ? []
          : fs
              .readdirSync(path.join(materialItemPath, 'components'), {
                encoding: 'utf-8',
              })
              .filter(junk.not)
              .map((dirName) => ({ name: dirName })),
    };
  });
  return result;
}
