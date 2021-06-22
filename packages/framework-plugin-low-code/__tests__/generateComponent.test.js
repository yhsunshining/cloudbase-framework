'use strict';

const { generator } = require('../lib');
const options = require('./.temp/data/dependences');
const path = require('path');
const fs = require('fs-extra');
const { build } = require('esbuild');
const { generateCompLibs } = generator;

function getCompLibCommonResource(debugCompLib) {
  function getResContent(target, type, defaultValue) {
    if (!target) {
      target = [];
    }
    const find = target.find((item) => item.type === type);
    return (find && find.content) || defaultValue;
  }

  return {
    materialName: debugCompLib.compLibCode,
    theme: {
      variable: getResContent(debugCompLib.themeContent, 'variable', ''),
      class: getResContent(debugCompLib.themeContent, 'class', ''),
    },
    class: getResContent(debugCompLib.commonRes, 'class', ''),
    const: {
      code: getResContent(debugCompLib.commonRes, 'const', ''),
      name: 'const',
      path: 'lib/const',
      type: 'lib',
      system: true,
    },
    tools: {
      code: getResContent(debugCompLib.commonRes, 'tools', ''),
      name: 'tools',
      path: 'lib/tools',
      type: 'lib',
      system: true,
    },
    npm: JSON.parse(getResContent(debugCompLib.commonRes, 'npm', '{}')),
  };
}

async function test() {
  const tempBuildDir = path.join(__dirname, './.temp');
  const npmDeps = {};
  const outJsFilePath = path.resolve(tempBuildDir, `./public/index.js`);
  const outCssFilePath = path.resolve(tempBuildDir, `./public/index.css`);

  let fileMap = await generateCompLibs(
    options.dependencies
      .map((item) => {
        // if (!item.isComposite) {
        //   return null;
        // }
        return {
          ...item,
          compLibCommonResource: getCompLibCommonResource(
            item.rawCompLibCommonRes || {}
          ),
        };
      })
      .filter((item) => !!item)
  );

  for (let key in fileMap) {
    let filePath = path.join(tempBuildDir, key);
    fs.ensureFileSync(filePath);
    fs.writeFileSync(filePath, fileMap[key].code);
  }

  const extensions = ['.tsx', '.ts', '.jsx', '.js', '.css', '.json'];
  const extensionsWithIndex = extensions
    .map((ext) => `/index${ext}`)
    .concat(extensions);
  const resolvePlugin = {
    name: 'resolvePlugin',
    setup(build) {
      build.onResolve({ filter: /^\/src\// }, (args) => {
        let filePath = path.join(tempBuildDir, args.path);
        if (fs.existsSync(filePath) && path.extname(filePath)) {
          return { path: filePath };
        }
        extensionsWithIndex.some((ext) => {
          const filePathWithExt = `${filePath}${ext}`;
          if (fs.existsSync(filePathWithExt)) {
            filePath = filePathWithExt;
            return true;
          }
        });
        return { path: filePath };
      });

      build.onResolve({ filter: /^[^/.]/ }, (args) => {
        if (path.extname(args.path)) {
          const fileExtPath = path.join(tempBuildDir, args.path);
          if (fs.existsSync(fileExtPath)) {
            return { path: fileExtPath };
          }
        }
        return { path: args.path, external: true };
      });
    },
  };

  let entryJsCode = getEntryFileCode(options.dependencies);
  function getEntryFileCode(compLibs) {
    let tempCode = '';
    compLibs
      .filter((item) => item.isComposite)
      .map((lib) => {
        lib.components.map((comp) => {
          tempCode += `exports['@${lib.name}/${comp.name}'] = require('/src/libraries/${lib.name}@${lib.version}/components/${comp.name}/index.jsx').default\n`;
        });
      });
    return tempCode;
  }
  const entryJsPath = path.join(tempBuildDir, '/src/index.js');
  fs.writeFileSync(entryJsPath, entryJsCode);

  // #4 打包
  const buildOptions = {
    entryPoints: [entryJsPath],
    bundle: true,
    keepNames: true,
    format: 'cjs',
    globalName: `__WaCompLibs`,
    external: [
      'react',
      'mobx-react-lite',
      'mobx',
      'lodash.get',
      'react-error-boundary',
      'history',
      '@govcloud/weapps-sdk/lib/app-h5-sdk',
      '@govcloud/weapps-sdk/lib/i18n',
      'lodash.remove',
      'lodash.set',
      'dayjs',
      ...Object.keys(npmDeps),
    ],
    logLevel: 'error',
    splitting: false,
    sourcemap: false,
    outfile: outJsFilePath,
    treeShaking: 'ignore-annotations',
    metafile: false,
    resolveExtensions: extensions,
    minify: false,
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    plugins: [resolvePlugin],
  };
  try {
    await build(buildOptions);
  } catch (e) {
    console.error('esbuild first build error', e);
    if (e && e.errors) {
      e.errors.map((item) => {
        const match = item.location.file.match(
          /src\/libraries\/(.+)@(.+)\/components\/(.+)\/index\.jsx/
        );
        if (match) {
          const compLibName = match[1];
          const compName = match[3];
          entryJsCode = entryJsCode.replace(
            new RegExp(`exports\\['@${compLibName}/${compName}'\\].+`),
            ''
          );
        }
      });
      fs.writeFileSync(entryJsPath, entryJsCode);
      try {
        await build(buildOptions);
      } catch (secondError) {
        ctx.logger.error('esbuild second build error', secondError);
        fs.remove(tempBuildDir);
        console.log({
          errorMsg: e.toString(),
          secondBuildErrorMsg: secondError.toString(),
          jsUrl: '',
          cssUrl: '',
        });
      }
    }
  }
}

try {
  test();
} catch (e) {
  console.log(e);
}
