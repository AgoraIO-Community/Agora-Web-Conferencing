# 声网教育场景demo  

*English Version: [English](README.md)*  

### 在线预览
  [web demo](https://solutions.agora.io/education/web/)

### 简介
  Agora Edu是基于声网的音视频sdk和实时消息sdk，以及Netless的白板sdk构成  
  主要功能如下:

  |功能概述|代码入口|功能描述|  
  | ---- | ----- | ----- |
  |老师1v1教学授课 | [one-to-one.tsx](./src/pages/classroom/one-to-one.tsx) | 1个老师和1个学生默认连麦进入教室 |
  |小班课场景：老师1v16学生教学授课| [small-class.tsx](./src/pages/classroom/small-class.tsx) | 1个老师和至多16个学生默认连麦进入教室 |
  |大班课场景：老师1v多学生，默认以观众身份进入频道，举手向老师发起连麦，老师接受连麦并且统一以后，连麦互动。| [big-class.tsx](./src/pages/classroom/big-class.tsx) | 1个老师默认连麦进入教室，学生进入无限制人数 |

### 使用的SDK
  * agora-rtc-sdk（web版声网sdk）
  * agora-rtm-sdk（web版声网实时消息sdk）
  * agora-electron-sdk（声网官方electron-sdk）
  * white-web-sdk（netless官方白板sdk）
  * ali-oss（可替换成你自己的oss client）
  * 声网云录制 （不推荐直接在客户端集成）

### 所用技术
  * typescript ^3.6.4
  * react & react hooks & rxjs
  * electron 5.0.8 & electron-builder
  * material-ui


### 开发环境
  * mac or windows
  * nodejs LTS
  * electron 5.0.8

### electron & node-sass 下载慢的解决方案
  * mac
  ```
  export ELECTRON_MIRROR="https://npm.taobao.org/mirrors/electron/"
  export ELECTRON_CUSTOM_DIR="5.0.8"
  export SASS_BINARY_SITE="https://npm.taobao.org/mirrors/node-sass/"

  ```
  * windows
  ```
  set ELECTRON_MIRROR=https://npm.taobao.org/mirrors/electron/
  set ELECTRON_CUSTOM_DIR=5.0.8
  set SASS_BINARY_SITE=https://npm.taobao.org/mirrors/node-sass/
  ```

### electron环境注意事项
  * mac 不需要修改package.json
  * windows 需要找到package.json里的`agora_electron` 按照如下结构替换
  ```
    "agora_electron": {
      "electron_version": "5.0.8",
      "prebuilt": true,
      "platform": "win32"
    },
  ```
  (windows上推荐手动安装electron 5.0.8)
  ```
  npm install electron@5.0.8 --arch=ia32 --save-dev
  ```

### 环境搭建

# 注意 
#### 如果你的appid项目里启用了证书服务，请在代码里搜索以下注释寻找使用到token的地方，在这里加入获取token的业务逻辑。
```
WARN: IF YOU ENABLED APP CERTIFICATE, PLEASE SIGN YOUR TOKEN IN YOUR SERVER SIDE AND OBTAIN IT FROM YOUR OWN TRUSTED SERVER API
```

# 搭建之前先获取 agora appid和netless sdktoken
  按照.env.example
  修改为.env.local
```bash
# 声网的APPID 通过声网开发者管理界面获取
REACT_APP_AGORA_APP_ID=Agora APPID
# true表示开启声网前端日志
REACT_APP_AGORA_LOG=true
# 白板的sdktoken 可以通过后台获取
REACT_APP_NETLESS_APP_TOKEN=SDKTOKEN
# 白板的api 详情请参考白板官方文档的集成指南
REACT_APP_NETLESS_APP_API_ENTRY=https://cloudcapiv4.herewhite.com/room?token=
REACT_APP_NETLESS_APP_JOIN_API=https://cloudcapiv4.herewhite.com/room/join?token=
# 声网的云录制服务地址 （不推荐在前端或客户端直接集成）
REACT_APP_AGORA_RECORDING_SERVICE_URL=https://api.agora.io/v1/apps/%s/cloud_recording/
# 存放云录制OSS的CDN地址
REACT_APP_AGORA_RECORDING_OSS_URL=云录制OSS地址
# 下列OSS相关的信息不建议放在前端存储
REACT_APP_AGORA_OSS_BUCKET_NAME=你的oss名字
REACT_APP_AGORA_OSS_BUCKET_FOLDER=你的oss存储目录
REACT_APP_AGORA_OSS_BUCKET_REGION=你的oss存储节点地区
REACT_APP_AGORA_OSS_BUCKET_KEY=你的oss存储key或者存储id
REACT_APP_AGORA_OSS_BUCKET_SECRET=你的oss的存储秘钥
```

# Web发布和开发操作  

#### 本地开发运行方式  
  `npm run dev`  

#### 本地编译方式  
  `npm run build`  

### 部署的时候需要修改package.json，然后执行npm run build  
  "homepage": "你的域名/路径"  

# Electron版发布和开发操作  

#### 本地运行  
  `npm run electron`  
  `此时会启动两个进程，一个进程使用cra的webpack编译构建render进程，electron主进程会等待webpack构建成功以后开始执行。`  

#### electron mac打包方式
  npm run pack:mac  
  等待成功运行结束时会产生一个release目录，默认会打包出一个dmg文件，正常打开更新到Application目录即可完成安装，然后可以执行程序。  

#### electron win32程序打包方式（执行之前请务必确保已经正确安装--arch=ia32版本5.0.8的electron和agora-electron-sdk "platform": "win32"版）
  npm run pack:win  
  
  等待成功运行结束时会产生一个release目录，默认会打包出一个安装程序，请使用windows管理员身份打开，即可完成安装，然后可以执行程序。  

#### FAQ  
  * [问题反馈](https://github.com/AgoraIO-Usecase/eEducation/issues/new)  
  * 关于electron启动时发现localhost:3000端口被占用问题解决方案，可以在package.json里找到ELECTRON_START_URL=http://localhost:3000 修改成你本地可以使用的端口号  
