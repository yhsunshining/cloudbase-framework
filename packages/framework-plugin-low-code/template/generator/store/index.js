import { observable } from 'mobx'
import initState from '../lowcode/state'

const globalState = observable(initState)
export default globalState
