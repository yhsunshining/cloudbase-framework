import { ChildProcess } from 'child_process';

interface IProcessOptions {
  onStdout?: (data: Buffer) => any;
  onStderr?: (data: Buffer) => any;
}

export function promisifyProcess(p: ChildProcess, opts: IProcessOptions = {}) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    p.stdout &&
      p.stdout.on(
        'data',
        opts.onStdout ||
          ((data) => {
            console.log(data + '');
            stdout += data;
          })
      );
    p.stderr &&
      p.stderr.on(
        'data',
        opts.onStderr ||
          ((data) => {
            console.error(data + '');
            stderr += data;
          })
      );
    p.on('error', reject);
    p.on('exit', (exitCode) => {
      exitCode === 0
        ? resolve(stdout)
        : reject(new Error(stderr || String(exitCode)));
    });
  });
}
