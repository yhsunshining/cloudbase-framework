import fs from "fs";
import path from "path";
import url from "url";

import { Plugin, PluginServiceApi } from "@cloudbase/framework-core";
import * as CI from "miniprogram-ci";

/**
 * 导出接口用于生成 JSON Schema 来进行智能提示
 */
interface IFrameworkPluginMiniProgramInputs {
  /**
   * 小程序应用的 appid
   */
  appid: string
  /**
   * 小程序应用的部署私钥的本地相对路径
   * 
   * @default "./private.key"
   */
  privateKeyPath: string
  /**
   * 小程序项目的本地相对路径
   * 
   * @default "./"
   */
  localPath: string
  /**
   * 小程序应用部署时忽略的文件路径，支持通配符
   * 
   * @default ["node_modules/**\/*"]
   */
  ignores?: string[]
  /**
   * 小程序应用的部署模式
   * 
   * @default "preview"
   */
  deployMode?: "preview" | "upload"
  /**
   * 预览代码的选项
   */
  previewOptions?: IMiniProgramPreviewOptions 
  /**
   * 上传代码的选项
   */
  uploadOptions?: IMiniProgramUploadOptions
}

interface IMiniProgramUploadOptions {
  /**
   * 小程序应用上传的版本号
   */
  version?: string
  /**
   * 小程序应用的版本描述
   * 
   * @default "CloudBase Framework 一键上传"
   */
  desc?: string
  /**
   * 小程序应用的编译设置
   */
  setting?:  IMiniProgramBuildSetting
}

interface IMiniProgramPreviewOptions {
  /**
   * 小程序的版本描述
   * 
   * @default "CloudBase Framework 一键预览"
   */
  desc?: string
  /**
   * 小程序应用的编译设置
   */
  setting?:  IMiniProgramBuildSetting
  /**
   * 生成的预览二维码保存在本地的路径
   */
  qrcodeOutputPath?: string
  /**
   * 小程序应用的预览页面地址
   * 
   * @default pages/index/index
   */
  pagePath?: string
  /**
   * 小程序应用的预览页面参数
   * 
   * @default 
   */
  searchQuery?: string
  /**
   * 小程序应用的预览页面场景值
   * 
   * @default 1011
   */
  scene?:  number
}

interface IMiniProgramBuildSetting {
  /**
   * 编译设置 - es6 转 es5
   * 
   * @default true
   */
  es6?: boolean
  /**
   * 编译设置 - 压缩代码
   */
  minify?: boolean
}

const SUPPORT_DEPLOY_MODE = ["upload", "preview"];

class MiniProgramsPlugin extends Plugin {
  protected resolvedInputs: IFrameworkPluginMiniProgramInputs;
  protected buildOutput: any;
  // ci
  protected ciProject: any;

  constructor(
    public name: string,
    public api: PluginServiceApi,
    public inputs: IFrameworkPluginMiniProgramInputs
  ) {
    super(name, api, inputs);

    const DEFAULT_INPUTS = {
      localPath: './',
      deployMode: 'preview',
      ignores: ["node_modules/**\/*"]
    };
    this.resolvedInputs = resolveInputs(this.inputs, DEFAULT_INPUTS);
  }

  /**
   * 初始化
   */
  async init() {
    this.api.logger.debug("MiniProgramPlugin: init", this.resolvedInputs);
    this.initCI();
  }

  initCI() {
    const { appid, privateKeyPath, localPath, ignores, deployMode } = this.resolvedInputs;

    if (!appid) {
      throw new Error('小程序 appid 不能为空，请在 cloudbaserc.json 中指明 appid. 小程序 appid 一般可以在 project.config.json 中找到');
    }

    if (!privateKeyPath || !fs.existsSync(path.join(this.api.projectPath, privateKeyPath))) {
      throw new Error('找不到小程序的部署私钥，请在 cloudbaserc.json 指明私钥文件路径 privateKeyPath. 小程序的部署私钥可在微信公众平台上登录后获取');
    }

    if (deployMode && !SUPPORT_DEPLOY_MODE.includes(deployMode)) {
      throw new Error(`CloudBase Framework: 不支持的小程序部署模式 '${deployMode}'`);
    }

    this.ciProject = new CI.Project({
      appid,
      type: 'miniProgram',
      projectPath: path.join(this.api.projectPath, localPath),
      privateKeyPath,
      ignores
    });
  }

  /**
   * 执行本地命令
   */
  async run() {}

  /**
   * 删除资源
   */
  async remove() {}

  /**
   * 生成代码
   */
  async genCode() {}

  /**
   * 构建
   */
  async build() {
    this.api.logger.debug("MiniProgramPlugin: build", this.resolvedInputs);
  }

  /**
   * 生成SAM文件
   */
  async compile() {
    return {
      
    }
  }

  /**
   * 部署
   */
  async deploy() {
    this.api.logger.debug("MiniProgramPlugin: deploy", this.resolvedInputs, this.buildOutput);

    const { deployMode } = this.resolvedInputs;
    switch(deployMode) {
      case 'upload': {
        await this.ciUpload();
        return;
      }
      case 'preview': {
        await this.ciPreview();
        return;
      }
      default: {
        return;
      }
    }
  }

  /**
   * 小程序-上传
   */
  async ciUpload() {
    // 需要暂时关掉 stdout, 避免 miniprogram-ci 的内容打印到控制台
    pauseConsoleOutput();
    const { 
      version = "1.0.0",
      desc = "CloudBase Framework 一键上传",
      setting 
    } = this.resolvedInputs.uploadOptions || {};
    const result = await CI.upload({
      project: this.ciProject,
      version,
      desc,
      setting
    }).catch((err) => {
      return err;
    });
    resumeConsoleOutput();

    if (result?.subPackageInfo) {
      this.api.logger.info(`${this.api.emoji("🚀")} 小程序（体验版v${this.resolvedInputs.uploadOptions?.version}）上传成功，请在小程序管理后台将其设置为体验版本`);
    } else {
      throw new Error(`小程序（预览版）部署失败 ${result}`);
    }
  }

  /**
   * 小程序-预览
   */
  async ciPreview() {
    // 需要暂时关掉 stdout, 避免 miniprogram-ci 的内容打印到控制台
    pauseConsoleOutput();
    const {
      desc = "CloudBase Framework 一键预览", 
      setting,
      qrcodeOutputPath = "./qrcode.jpg", 
      pagePath = "pages/index/index", 
      searchQuery = "", 
      scene = 1011
    } = this.resolvedInputs.previewOptions || {};
    const result = await CI.preview({
      project: this.ciProject,
      version: "0.0.1",
      desc,
      setting,
      qrcodeFormat: 'image',
      qrcodeOutputDest: path.join(this.api.projectPath, qrcodeOutputPath),
      pagePath,
      searchQuery,
      scene
    }).catch((err) => {
      return err;
    })
    resumeConsoleOutput();

    if (result?.subPackageInfo) {
      const link = this.api.genClickableLink(url.format({
        protocol: 'file:',
        host: path.join(this.api.projectPath, qrcodeOutputPath)
      }));
      this.api.logger.info(`${this.api.emoji("🚀")} 小程序（预览版）部署成功，预览二维码地址：${link}`);
    } else {
      throw new Error(`小程序（预览版）部署失败 ${result}`);
    }
  }
}

function resolveInputs(inputs: any, defaultInputs: any) {
  return Object.assign({}, defaultInputs, inputs);
}

const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalStderrWrite = process.stderr.write.bind(process.stderr);
// 暂停控制台输出
function pauseConsoleOutput() {
  process.stdout.write = () => {
    return true;
  }
  process.stderr.write = () => {
    return true;
  }
}
// 恢复控制台输出
function resumeConsoleOutput() {
  process.stdout.write = originalStdoutWrite;
  process.stderr.write = originalStderrWrite;
}

export const plugin = MiniProgramsPlugin;
