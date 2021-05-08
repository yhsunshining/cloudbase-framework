export enum APPbuildTypes {
  Android = 1,
  iOS,
  web,
  app, // app 里的h5
  qywxH5,
  wxH5,
}
export enum APPbuildModes {
  'Production' = 1,
  'Debugger',
}

export enum APPbuildStatus {
  'INITIALIZING',
  'RUNNING',
  'SUCCEED',
  'FAILED',
}

export interface IAppBuildContent {
  url?: string; // h5 打包资源 上传之后的url
  h5AppBuildId?: number; // h5 app构建的存表id
  h5Version?: string;
  h5log?: string;
  FileName?: string; // 创建发布版本的文件名
}

export const ChannelTypes = ['androidChannel', 'iOSChannel'];

export const H5BuildTypes = [
  {
    value: 'web',
    label: "普通Web应用 （process.env.buildType = 'web'）",
  },
  {
    value: 'app',
    label: "Hybrid App内嵌h5 （process.env.buildType = 'app'）",
  },
  {
    value: 'qywxH5',
    label: "企业微信（政务微信）h5 （process.env.buildType = 'qywxH5'）",
  },
  {
    value: 'wxH5',
    label: "微信网页h5 （process.env.buildType = 'wxH5'）",
  },
];

export enum CodingPublishType {
  Android = 'android',
  iOS = 'ios',
  H5 = 'h5',
}

export interface ICtnProps {
  name: string;
  createTime: number;
  uri: string;
}

export interface IOutputs {
  h5JobId?: string;
  androidJobId?: string;
  iOSJobId?: string;
  logo: string;
  name: string;
  appid?: string;
  iOSappId?: string;
  androidCtn: ICtnProps;
  iOSCtn: ICtnProps;
}

// ios 所有支持的渠道配置
export enum IOSChannelTypes {
  development = 'development',
  adhoc = 'ad-hoc',
  appStore = 'app-store',
  enterprise = 'enterprise',
}

// ios可选择渠道汇总
export const IOSChannels = [
  {
    value: IOSChannelTypes.development,
    title: 'development测试分发',
    label:
      '用于给我们内部人员测试使用的，指定的授权用户设备才可以安装，可部署到服务器下载安装，需要开发证书打包',
  },
  {
    value: IOSChannelTypes.adhoc,
    title: 'ad-hoc测试分发',
    label:
      '用于给我们内部人员测试使用的，指定的授权用户设备才可以安装，可部署到服务器下载安装，需要发布证书打',
  },
  {
    value: IOSChannelTypes.appStore,
    title: 'app-store商店分发 ',
    label: '用于提交到商店审核，用户设备只能通过在App Store下载安装',
  },
  {
    value: IOSChannelTypes.enterprise,
    title: 'enterprise企业分发',
    label:
      '布署到服务器，所有用户设备都可通过扫描二维码或使用浏览器点击链接下载安装',
  },
];
