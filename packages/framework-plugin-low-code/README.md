<a href="https://github.com/TencentCloudBase/cloudbase-framework/tree/master/packages/framework-plugin-low-code">![Tencent CloudBase Framework Low-Code Plugin](https://main.qcloudimg.com/raw/5d4dcbab8a44fbd9fa308bb285ed4e39.jpg)</a>

# Tencent CloudBase Framework Low-Code Plugin

[![Github License](https://img.shields.io/github/license/TencentCloudBase/cloudbase-framework)](LICENSE)
[![Npm version](https://img.shields.io/npm/v/@cloudbase/framework-plugin-low-code)](https://www.npmjs.com/package/@cloudbase/framework-plugin-low-code)
[![issue](https://img.shields.io/github/issues/TencentCloudBase/cloudbase-framework)](https://github.com/TencentCloudBase/cloudbase-framework/issues)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/TencentCloudBase/cloudbase-framework/pulls)
[![star](https://img.shields.io/github/stars/TencentCloudBase/cloudbase-framework?style=social)](https://github.com/TencentCloudBase/cloudbase-framework)

**云开发 CloudBase Framework 框架「低码应用」插件**： 通过云开发 **[CloudBase Framework](https://github.com/TencentCloudBase/cloudbase-framework)** 框架结合低码平台一键生成并部署微信小程序或 web 应用。

## 功能特性

## 使用方法

### 步骤一. 准备工作

具体步骤请参照 [准备云开发环境和 CloudBase CLI 命令工具](../../CLI_GUIDE.md)

### 步骤二. 进入项目目录进行初始化

如果是目前已有的小程序应用项目

```bash
cloudbase
```

### 步骤三. 一键部署

```bash
cloudbase framework:deploy
```

## 配置

需要根据低码平台生成的描述 json 配置 `appId`、`mainAppSerializeData`、`dependencies`，还可配置 `buildTypeList` 等参数满足特殊需求的场景。

### 配置示例

`cloudbase init` 之后会创建云开发的配置文件 `cloudbaserc.json`，可在配置文件的 plugins 里修改和写入插件配置，其中 inputs 字段为插件输入参数，也可单独创建独立的 `input.json` 文件声明

```json
{
  "envId": "{{envId}}",
  "framework": {
    "plugins": {
      "client": {
        "use": "@cloudbase/framework-plugin-mp",
        "inputs": {
          "appId": "appid for low-code app",
          "mainAppSerializeData": {},
          "dependencies": [{}]
        }
      }
    }
  }
}
```

### 配置参数说明

### `appId`

必填，低码应用的 appId

### `mainAppSerializeData`

必填，对象，低码应用描述数据

### `dependencies`

必填，对象数组，低码应用组件依赖

### `buildTypeList`

选填，字符串数组，低码应用构建类型，["mp"] 或 ["web"], 代表构建微信小程序或 web 应用,默认微信小程序

### `mpAppId`

当 buildTypeList 为["mp"] 时必填，字符串，需要构建的微信小程序 id

### `mpDeployPrivateKey`

当 buildTypeList 为["mp"] 时必填，字符串，小程序构建私钥，可在微信小程序后台下载，获取内容

### `deployOptions

当 buildTypeList 为["mp"] 时必填，对象格式
| 属性名称 | 类型 | 是否必填 | 描述 |
| ---------------- | ----------------------------- | -------- | -------------------------------- |
| mode | String | 是 | 小程序构建类型，预览或正式发布 preview 或 upload |
| version | String | 否 | mode 为 upload 时必填，发布版本号 |
| description | String | 否 | mode 为 upload 时使用，发布说明 |

## 更多插件

请访问 [CloudBase Framework 插件列表](https://github.com/TencentCloudBase/cloudbase-framework#%E7%9B%AE%E5%89%8D%E6%94%AF%E6%8C%81%E7%9A%84%E6%8F%92%E4%BB%B6%E5%88%97%E8%A1%A8) 搭配使用其他插件

## 文档资料

- 云开发官网地址： [https://cloudbase.net/](https://cloudbase.net/)
- 云开发静态网站开通指南：[https://docs.cloudbase.net/hosting/](https://docs.cloudbase.net/hosting/)
- 云开发控制台地址： [https://console.cloud.tencent.com/tcb](https://console.cloud.tencent.com/tcb)
