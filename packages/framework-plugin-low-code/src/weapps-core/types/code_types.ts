// Types of code modules supported by WeApps platform

export type CodeType =
  | 'rematch'
  | 'rematch-action'
  | 'computed'
  | 'general-func'
  | 'general'
  | 'lifecycle'
  | 'config'
  | 'state'
  | 'handler-fn'
  | 'normal-module'
  | 'app-style'
  | 'style'
  | 'theme'
  | 'lib'
  | 'index'

  // 后面都整合为 json
  | 'json'
  | 'app-config'
  | 'page-config'
  | 'page';

export type RematchModule<State> = (args: {
  sdk;
  history;
}) => {
  state: State;
  reducers: { [funcName: string]: (state: State, payload) => State };
  effects: (dispatch) => { [funcName: string]: RematchActionFunc };
  computed?: { [funcName: string]: (state: State) => any };
};

export type RematchAction = (dispatch) => RematchActionFunc;

export type GeneralFunction = (userParams: any) => any; // General js function without any spec

export type GeneralModule = any; // General js module, can be function, variables, configs or any other.

export type RematchActionFunc = (args: {
  data;
  customEventData;
  history;
  FormActions;
}) => Promise<any> | any;
