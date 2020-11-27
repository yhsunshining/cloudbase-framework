import { IWeAppComponentInstance } from '../../weapps-core'

export function walkThroughWidgets(
  widgets: { [key: string]: IWeAppComponentInstance },
  fn: (id: string, widget: IWeAppComponentInstance, parentId: string) => void,
  currentId?: string
) {
  for (const id in widgets) {
    const { properties: children, xComponent, xProps } = widgets[id]
    const { directives } = xProps || {}
    if (directives && directives.waIf && directives.waIf.value === false) {
      continue
    }
    const isSlot = !xComponent
    !isSlot && fn(id, widgets[id], currentId as string)
    children && walkThroughWidgets(children, fn, isSlot ? currentId : id)
  }
}
