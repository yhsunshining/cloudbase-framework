export interface IMaterialItem {
  name: string
  version: string
  srcZipUrl: string
  actions: { name: string }[]
  components: { name: string }[]
  isComposite?: boolean
  // ToDo more props
}

export interface IDependencies {
  [key: string]: string
}
