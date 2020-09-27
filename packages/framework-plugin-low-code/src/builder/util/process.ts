import { ChildProcess } from 'child_process'

interface IProcessOptions {
  onStdout?: (data: Buffer) => any
  onStderr?: (data: Buffer) => any
}

export function promisifyProcess(p: ChildProcess, opts: IProcessOptions = {}) {
  return new Promise((resolve, reject) => {
    p.stdout && p.stdout.on('data', opts.onStdout || (data => console.log(data + '')))
    p.stderr && p.stderr.on('data', opts.onStderr || (data => console.error(data + '')))
    p.on('error', reject)
    p.on('exit', exitCode => {
      if (exitCode === 0) {
        resolve()
      } else {
        reject(exitCode)
      }
    })
  })
}
