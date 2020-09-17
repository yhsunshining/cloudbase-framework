import chalk from 'chalk'
export function notice(...msg) {
  console.log(
    chalk.yellowBright.bold(
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~我是notice分割线-start~~~~~~~~~~~~~~~~~~~~~~~~~~~'
    )
  )
  console.log(...msg.map(item => chalk.yellow(item)))
  console.log(
    chalk.yellowBright.bold(
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~我是notice分割线-end~~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
    )
  )
}

export function log(...msg) {
  console.log(...msg.map(item => chalk.hex(item)))
}
