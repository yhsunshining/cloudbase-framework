export function evalExpression(code: string, runtime) {
  try {
    return runtime.eval(`(function(forItems){return ${code};})`)
  } catch (e) {
    runtime.console.error(`Error in expression:\t${code}\n\n`, e)
  }
}
