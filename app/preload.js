const {ipcRenderer: ipc} = require('electron');

const AgoraRtcEngine = require('agora-electron-sdk').default;

window.ipc = ipc;

const rtcEngine = new AgoraRtcEngine();

window.rtcEngine = rtcEngine;