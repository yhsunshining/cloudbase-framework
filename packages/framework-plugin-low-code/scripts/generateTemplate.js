const fs = require('fs');
const path = require('path');
const glob = require('glob');

const chokidar = require('chokidar');
const TEMPLATE_PATH = path.join(__dirname, '../template/generator');

// One-liner for current directory
generateTemplate();
if (process.env.npm_config_watch) {
  chokidar.watch(TEMPLATE_PATH).on('all', (event, path) => {
    console.log(event, path);
    generateTemplate();
  });
}

function generateTemplate() {
  const files = glob.sync('**/*', { cwd: TEMPLATE_PATH, nodir: true });
  const filesObj = files.reduce((obj, file) => {
    obj[`/src/${file}`] = {
      code: fs.readFileSync(path.join(TEMPLATE_PATH, file), {
        encoding: 'utf8',
      }),
    };
    return obj;
  }, {});
  fs.writeFileSync(
    path.join(__dirname, '../src/generator/template.ts'),
    `export default ${JSON.stringify(filesObj, null, 2)}`
  );
}
