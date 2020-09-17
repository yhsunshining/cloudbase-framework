export function evalExpression(code: string, runtime: typeof window) {
  try {
    return runtime.eval(`(function(forItems){return ${code};})`)
  } catch (e) {
    runtime.console.error(`Error in expression:\t${code}\n\n`, e)
  }
}
