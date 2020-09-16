import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";

import { Plugin, PluginServiceApi } from "@cloudbase/framework-core";

/**
 * 导出接口用于生成 JSON Schema 来进行智能提示
 */
export interface IFrameworkPluginLowCodeInputs {}

class LowCodePlugin extends Plugin {
  constructor(
    public name: string,
    public api: PluginServiceApi,
    public inputs: IFrameworkPluginLowCodeInputs
  ) {
    super(name, api, inputs);
  }

  /**
   * 初始化
   */
  async init() {}

  async compile() {}

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
  async build() {}

  /**
   * 部署
   */
  async deploy() {}
}

export const plugin = LowCodePlugin;
