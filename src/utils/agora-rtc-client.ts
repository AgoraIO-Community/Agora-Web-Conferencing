import EventEmitter from 'events';
import AgoraRTC from 'agora-rtc-sdk';
import { roomStore, RoomStore } from '../stores/room';
import { isEmpty } from 'lodash';

// TODO: upload log file
// TODO: 建议开启上传日志
AgoraRTC.Logger.enableLogUpload()

export interface AgoraStreamSpec {
  streamID: number
  video: boolean
  audio: boolean
  mirror?: boolean
  screen?: boolean
  microphoneId?: string
  cameraId?: string
  audioOutput?: {
    volume: number
    deviceId: string
  }
}

const streamEvents: string[] = [
  "accessAllowed", 
  "accessDenied",
  "stopScreenSharing",
  "videoTrackEnded",
  "audioTrackEnded",
  "player-status-changed"
];

const clientEvents: string[] = [
  'stream-published',
  'stream-added',
  'stream-removed',
  'stream-subscribed',
  'peer-online',
  'peer-leave',
  'error',
  'network-type-changed',
  'network-quality',
  'exception',
  'onTokenPrivilegeWillExpire',
  'onTokenPrivilegeDidExpire',
]

export const APP_ID = process.env.REACT_APP_AGORA_APP_ID as string;
export const APP_TOKEN = process.env.REACT_APP_AGORA_APP_TOKEN as string;
export const ENABLE_LOG = process.env.REACT_APP_AGORA_LOG as string === "true";
// TODO: default screen sharing uid, please do not directly use it.
export const SHARE_ID = 7;

class AgoraRTCClient {

  private streamID: any;
  public _init: boolean = false;
  public _joined: boolean = false;
  public _published: boolean = false;
  private _internalTimer: NodeJS.Timeout | any;
  public _client: any = AgoraRTC.createClient({mode: 'live', codec: 'vp8'});
  public _bus: EventEmitter = new EventEmitter();
  public _localStream: any = null;
  public _streamEvents: string[];
  public _clientEvents: string[];

  constructor () {
    this.streamID = null;
    this._streamEvents = [];
    this._clientEvents = [];
  }

  // init rtc client when _init flag is false;
  async initClient(appId: string) {
    if (this._init) return;
    let prepareInit = new Promise((resolve, reject) => {
      this._init === false && this._client.init(appId, () => {
        this._init = true;
        resolve()
      }, reject);
    })
    await prepareInit;
  }

  // create rtc client;
  async createClient(appId: string, enableRtt?: boolean) {
    await this.initClient(appId);
    this.subscribeClientEvents();
    if (enableRtt) {
      this._internalTimer = setInterval(() => {
        this._client.getTransportStats((stats: any) => {
          const RTT = stats.RTT ? stats.RTT : 0;
          this._bus.emit('watch-rtt', RTT);
        });
      }, 100);
    }
  }

  destroyClient(): void {
    this.unsubscribeClientEvents();
  }

  subscribeClientEvents() {
    for (let evtName of clientEvents) {
      this._clientEvents.push(evtName);
      this._client.on(evtName, (args: any) => {
        if (evtName === "peer-leave") {
          console.log("[agora-web] peer-leave: ", args);
        }
        
        this._bus.emit(evtName, args);
      });
    }
  }

  unsubscribeClientEvents() {
    for (let evtName of this._clientEvents) {
      this._client.off(evtName, () => {});
      this._clientEvents = this._clientEvents.filter((it: any) => it === evtName);
    }
  }

  subscribeLocalStreamEvents() {
    for (let evtName of streamEvents) {
      this._streamEvents.push(evtName);
      this._localStream.on(evtName, (args: any) => {
        this._bus.emit(evtName, args);
      });
    }
  }

  unsubscribeLocalStreamEvents() {
    if (this._localStream) {
      for (let evtName of this._streamEvents) {
        this._localStream.removeEventListener(evtName, (args: any[]) => {});
        this._streamEvents = this._streamEvents.filter((it: any) => it === evtName);
      }
    }
  }

  renewToken(newToken: string) {
    if (!this._client) return console.warn('renewToken is not permitted, checkout your instance');
    this._client.renewToken(newToken);
  }

  removeAllListeners() {
    this.unsubscribeClientEvents();
    this._bus.removeAllListeners();
  }

  // subscribe
  on(evtName: string, cb: (args: any) => void) {
    this._bus.on(evtName, cb);
  }

  // unsubscribe
  off(evtName: string, cb: (args: any) => void) {
    this._bus.off(evtName, cb);
  }

  async publish() {
    return new Promise((resolve, reject) => {
      if (this._published) {
        return resolve();
      }
      this._client.publish(this._localStream, (err: any) => {
        reject(err);
      })
      setTimeout(() => {
        resolve();
        this._published = true;
      }, 300);
    })
  }

  async unpublish() {
    return new Promise((resolve, reject) => {
      if (!this._published || !this._localStream) {
        return resolve();
      }
      this._client.unpublish(this._localStream, (err: any) => {
        reject(err);
      })
      setTimeout(() => {
        resolve();
        this.destroyLocalStream();
        this._published = false;
      }, 300);
    })
  }

  setRemoteVideoStreamType(stream: any, streamType: number) {
    this._client.setRemoteVideoStreamType(stream, streamType);
  }

  async enableDualStream() {
    return new Promise((resolve, reject) => {
      this._client.enableDualStream(resolve, reject);
    });
  }

  createLocalStream(data: AgoraStreamSpec): Promise<any> {
    this._localStream = AgoraRTC.createStream({...data, mirror: false});
    return new Promise((resolve, reject) => {
      this._localStream.init(() => {
        this.streamID = data.streamID;
        this.subscribeLocalStreamEvents();
        if (data.audioOutput && data.audioOutput.deviceId) {
          this.setAudioOutput(data.audioOutput.deviceId).then(() => {
            console.log("setAudioOutput success", data.audioOutput)
          }).catch((err: any) => {
            console.warn("setAudioOutput failed", err, JSON.stringify(err))
          })
        }
        resolve();
      }, (err: any) => {
        reject(err);
      })
    });
  }

  destroyLocalStream () {
    this.unsubscribeLocalStreamEvents();
    if(this._localStream) {
      if (this._localStream.isPlaying()) {
        this._localStream.stop();
      }
      this._localStream.close();
    }
    this._localStream = null;
    this.streamID = 0;
  }

  async join (uid: number, channel: string, token?: string) {
    return new Promise((resolve, reject) => {
      this._client.join(token, channel, +uid, resolve, reject);
    })
  }

  async leave () {
    if (this._client) {
      return new Promise((resolve, reject) => {
        this._client.leave(resolve, reject);
      })
    }
  }

  setAudioOutput(speakerId: string) {
    return new Promise((resolve, reject) => {
      this._client.setAudioOutput(speakerId, resolve, reject);
    })
  }

  setAudioVolume(volume: number) {
    this._client.setAudioVolume(volume);
  }

  subscribe(stream: any) {
    this._client.subscribe(stream, {video: true, audio: true}, (err: any) => {
      console.log('[rtc-client] subscribe failed: ', JSON.stringify(err));
    });
  }

  destroy (): void {
    this._internalTimer && clearInterval(this._internalTimer);
    this._internalTimer = null;
    this.destroyLocalStream();
  }

  async exit () {
    try {
      await this.leave();       
    } catch (err) {
      throw err;
    } finally {
      await this.destroy();
    }
  }

  getDevices (): Promise<Device[]> {
    return new Promise((resolve, reject) => {
      AgoraRTC.getDevices((devices: any) => {
        const _devices: any[] = [];
        devices.forEach((item: any) => {
          _devices.push({deviceId: item.deviceId, kind: item.kind, label: item.label});
        })
        resolve(_devices);
      }, (err: any) => {
        reject(err);
      });
    })
  }
}

export default class AgoraWebClient {

  public readonly rtc: AgoraRTCClient;
  public shareClient: AgoraRTCClient | any;
  public localUid: number;
  public channel: string;
  public readonly bus: EventEmitter;
  public shared: boolean;
  public joined: boolean;
  public published: boolean;
  public tmpStream: any;

  private roomStore: RoomStore;

  constructor(deps: {roomStore: RoomStore}) {
    this.localUid = 0;
    this.channel = '';
    this.rtc = new AgoraRTCClient();
    this.bus = new EventEmitter();
    this.shared = false;
    this.shareClient = null;
    this.tmpStream = null;
    this.joined = false;
    this.published = false;
    
    this.roomStore = deps.roomStore;
  }

  async getDevices () {
    const client = new AgoraRTCClient()
    try {
      const devices = await client.getDevices()

      const cameraList = devices.filter((it: any) => it.kind === 'videoinput')
      const microphoneList = devices.filter((it: any) => it.kind === 'audioinput')

      if (!cameraList.length) {
        throw 'cameraList is empty'
      }

      if (!microphoneList.length) {
        throw 'microphoneList is empty'
      }

      const cameraId = cameraList[0].deviceId
      const microphoneId = microphoneList[0].deviceId
      await client.initClient(APP_ID)
      const params = {
        streamID: 0,
        audio: true,
        video: true,
        screen: false,
        microphoneId,
        cameraId,
      }
      await client.createLocalStream(params)
      return devices
    } catch(err) {
      throw err
    } finally {
      client.destroyLocalStream()
    }
  }


  async joinChannel({
    uid, channel, dual, token
  }: {
    uid: number,
    channel: string,
    dual: boolean,
    token: string
  }) {
    this.localUid = uid;
    this.channel = channel;
    await this.rtc.createClient(APP_ID, true);
    await this.rtc.join(this.localUid, channel, token);
    dual && await this.rtc.enableDualStream();
    this.joined = true;
    roomStore.setRTCJoined(true);
  }

  async leaveChannel() {
    this.localUid = 0;
    this.channel = '';
    try {
      await this.unpublishLocalStream();
      await this.rtc.leave();
      this.joined = false;
      roomStore.setRTCJoined(false);
    } catch (err) {
      throw err;
    } finally {
      this.rtc.destroy();
      this.rtc.destroyClient();
    }
  }

  async enableDualStream() {
    return this.rtc.enableDualStream();
  }

  async publishLocalStream(data: AgoraStreamSpec) {
    console.log(" publish local stream ", this.published);
    if (this.published) {
      await this.unpublishLocalStream();
      console.log("[agora-web] unpublished", this.published);
    }

    if (!data.cameraId || !data.microphoneId) {
      let devices = await this.getDevices()
      if (!data.cameraId) {
        data.cameraId = devices.filter((it: any) => it.kind === 'videoinput')[0].deviceId
      }
      if (!data.microphoneId) {
        data.microphoneId = devices.filter((it: any) => it.kind === 'audioinput')[0].deviceId
      }
    }

    await this.rtc.createLocalStream(data);
    await this.rtc.publish();
    this.published = true;
  }

  async unpublishLocalStream() {
    console.log("[agora-web] invoke unpublishStream");
    await this.rtc.unpublish();
    this.published = false;
  }

  async startScreenShare (token: string) {
    this.shareClient = new AgoraRTCClient();
    await this.shareClient.createLocalStream({
      video: false,
      audio: false,
      screen: true,
      screenAudio: true,
      streamID: SHARE_ID,
      microphoneId: '',
      cameraId: ''
    })
    await this.shareClient.createClient(APP_ID);
    await this.shareClient.join(SHARE_ID, this.channel, token);
    await this.shareClient.publish();
    this.shared = true;
  }

  async stopScreenShare () {
    await this.shareClient.unpublish();
    await this.shareClient.leave();
    await this.shareClient.destroy();
    await this.shareClient.destroyClient();
    roomStore.removeLocalSharedStream();
    this.shared = false;
  }

  async exit () {
    const errors: any[] = [];
    try {
      await this.leaveChannel();
    } catch(err) {
      errors.push({'rtcClient': err});
    }
    if (this.shared === true) {
      try {
        await this.shareClient.unpublish();
        await this.shareClient.leave();
      } catch (err) {
        errors.push({'shareClient': err});
      }
    }
    if (this.shareClient) {
      try {
        await this.shareClient.destroy();
        await this.shareClient.destroyClient();
      } catch(err) {
        errors.push({'shareClient': err});
      }
    }
    if (!isEmpty(errors)) {
      throw errors;
    }
  }

  async createPreviewStream({cameraId, microphoneId, speakerId}: any) {
    const tmpStream = AgoraRTC.createStream({
      video: true,
      audio: true,
      screen: false,
      cameraId,
      microphoneId,
      speakerId
    });

    if (this.tmpStream) {
      this.tmpStream.isPlaying() && this.tmpStream.stop();
      this.tmpStream.close();
    }

    return new Promise((resolve, reject) => {
      tmpStream.init(() => {
        this.tmpStream = tmpStream;
        resolve(tmpStream);
      }, (err: any) => {
        reject(err);
      })
    });
  }

  subscribe(stream: any) {
    this.rtc.subscribe(stream);
  }

  setRemoteVideoStreamType(stream: any, type: number) {
    this.rtc.setRemoteVideoStreamType(stream, type);
  }
}
