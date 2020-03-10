import { APP_ID } from './../utils/agora-rtm-client';
import { EventEmitter } from 'events';
import { videoPlugin } from '@netless/white-video-plugin';
import { audioPlugin } from '@netless/white-audio-plugin';
import { Room, WhiteWebSdk, DeviceType, SceneState, createPlugins, RoomPhase } from 'white-web-sdk';
import { Subject } from 'rxjs';
import { WhiteboardAPI, RecordOperator } from '../utils/api';
import {Map} from 'immutable';
import GlobalStorage from '../utils/custom-storage';
import { isEmpty, get } from 'lodash';
import { roomStore } from './room';
import { handleRegion } from '../utils/helper';
import { globalStore } from './global';
import { t } from '../i18n';

const ENABLE_LOG = process.env.REACT_APP_AGORA_LOG === 'true';
const RECORDING_UID = 1;

interface SceneFile {
  name: string
  type: string
}

export interface CustomScene {
  path: string
  rootPath: string
  file: SceneFile
  type: string
  current: boolean
  currentPage: number
  totalPage: number
}

export interface SceneResource {
  path: string
  rootPath: string
  file: SceneFile
}

const pathName = (path: string): string => {
  const reg = /\/([^\/]*)\//g;
  reg.exec(path);
  if (RegExp.$1 === "aria") {
      return "";
  } else {
      return RegExp.$1;
  }
}

export const plugins = createPlugins({"video": videoPlugin, "audio": audioPlugin});

plugins.setPluginContext("video", {identity: 'guest'});
plugins.setPluginContext("audio", {identity: 'guest'});

export type WhiteboardState = {
  loading: boolean
  joined: boolean
  scenes: Map<string, CustomScene>
  currentScenePath: string
  currentHeight: number
  currentWidth: number
  dirs: SceneResource[]
  activeDir: number
  zoomRadio: number
  scale: number
  room: Room | null
  recording: boolean
  startTime: number
  endTime: number
}

type JoinParams = {
  rid: string
  uid?: string
  location?: string
  userPayload: {
    userId: string,
    identity: string
  }
}

class Whiteboard extends EventEmitter {
  public state: WhiteboardState;
  public subject: Subject<WhiteboardState> | null;
  public defaultState: WhiteboardState = {
    joined: false,
    scenes: Map<string, CustomScene>(),
    currentScenePath: '',
    currentHeight: 0,
    currentWidth: 0,
    dirs: [],
    activeDir: 0,
    zoomRadio: 0,
    scale: 0,
    recording: false,
    startTime: 0,
    endTime: 0,
    room: null,
    loading: true,
    ...GlobalStorage.read('mediaDirs'),
  }

  public readonly client: WhiteWebSdk = new WhiteWebSdk({
    deviceType: DeviceType.Surface,
    // handToolKey: " ",
    plugins,
    loggerOptions: {
      disableReportLog: ENABLE_LOG ? false : true,
      reportLevelMask: "debug",
      printLevelMask: "debug",
    }
  });

  constructor() {
    super();
    this.subject = null;
    this.state = this.defaultState;
  }

  initialize() {
    this.subject = new Subject<WhiteboardState>();
    this.state = {
      ...this.defaultState,
    }
    this.subject.next(this.state);
  }

  subscribe(updateState: any) {
    this.initialize();
    this.subject && this.subject.subscribe(updateState);
  }

  unsubscribe() {
    this.subject && this.subject.unsubscribe();
    this.subject = null;
  }

  commit (state: WhiteboardState) {
    this.subject && this.subject.next(state);
  }

  updateState(newState: WhiteboardState) {
    this.state = {
      ...this.state,
      ...newState,
    }
    this.commit(this.state);
  }

  updateRoomState(file?: SceneFile) {
    if (!this.state.room) return;
    const roomState = this.state.room.state;

    const path = roomState.sceneState.scenePath;
    const ppt = roomState.sceneState.scenes[0].ppt;

    const type = isEmpty(ppt) ? 'static' : 'dynamic';
    const currentPage = roomState.sceneState.index;
    const totalPage = roomState.sceneState.scenes.length;

    if (type !== 'dynamic') {
      this.state = {
        ...this.state,
        currentHeight: 0,
        currentWidth: 0
      }
    } else {
      this.state = {
        ...this.state,
        currentHeight: get(ppt, 'height', 0),
        currentWidth: get(ppt, 'width', 0)
      }
    }

    const _dirPath = pathName(path);
    const dirPath = _dirPath === "" ? "/init" : `/${_dirPath}`;

    const scenes = this.state.scenes.update(dirPath, (value: CustomScene) => {
      const sceneFile: SceneFile = {
        name: 'whiteboard',
        type: 'whiteboard'
      }
      if (file && dirPath !== "/init") {
        sceneFile.name = file.name;
        sceneFile.type = file.type;
      }

      const result = {
        ...value,
        path: dirPath,
        type: type ? type : 'static',
        currentPage,
        totalPage,
      }
      if (!value || isEmpty(value.file)) {
        result.file = sceneFile;
      }
      if (!value || isEmpty(value.rootPath)) {
        result.rootPath = roomState.sceneState.scenePath
      }
      return result;
    });

    const _dirs: SceneResource[] = [];
    scenes.forEach((it: CustomScene) => {
      _dirs.push({
        path: it.path,
        rootPath: it.rootPath,
        file: it.file
      });
    });

    const currentDirIndex = _dirs.findIndex((it: SceneResource) => it.path === dirPath);

    this.state = {
      ...this.state,
      scenes: scenes,
      currentScenePath: dirPath,
      dirs: _dirs,
      activeDir: currentDirIndex !== -1 ? currentDirIndex : 0
    }
    this.commit(this.state);
  }

  setCurrentScene(dirPath: string) {
    const currentDirIndex = this.state.dirs.findIndex((it: SceneResource) => it.path === dirPath);
    this.state = {
      ...this.state,
      currentScenePath: dirPath,
      activeDir: currentDirIndex !== -1 ? currentDirIndex : 0
    }
    this.commit(this.state);
  }

  updateSceneState(sceneState: SceneState) {
    const path = sceneState.scenePath;
    const currentPage = sceneState.index;
    const totalPage = sceneState.scenes.length;
    const _dirPath = pathName(path);
    const dirPath = _dirPath === "" ? "/init" : `/${_dirPath}`;

    const scenes = this.state.scenes.update(dirPath, (value) => {
      return {
        ...value,
        currentPage,
        totalPage,
      }
    });

    this.state = {
      ...this.state,
      scenes,
    }

    this.commit(this.state);
  }

  updateScale(scale: number) {
    this.state = {
      ...this.state,
      scale: scale
    }
    
    this.commit(this.state);
  }

  async connect(rid: string, uuid?: string) {
    let retrying;
    let time = 0;
    let reason;
    do {
      try {
        let res;
        if (uuid) {
          res = await WhiteboardAPI.joinRoom(uuid);
        } else {
          res = await WhiteboardAPI.createRoom({rid, limit: 100, mode: 'historied'});
        }
        retrying = false;
        return res;
      } catch(err) {
        retrying = true;
        time++;
        reason = err;
      }
    } while(retrying && time < 3);
    throw reason;
  }

  updateLoading(value: boolean) {
    this.state = {
      ...this.state,
      loading: value
    }
    this.commit(this.state);
  }

  async join({rid, uid, location, userPayload}: JoinParams) {
    await this.leave();
    const {uuid, roomToken} = await this.connect(rid, uid);
    const identity = userPayload.identity === 'host' ? 'host' : 'guest';

    plugins.setPluginContext("video", {identity});
    plugins.setPluginContext("audio", {identity});

    const disableDeviceInputs: boolean = location!.match(/big-class/) && identity !== 'host' ? true : false;
    const disableOperations: boolean = location!.match(/big-class/) && identity !== 'host' ? true : false;
    // const isWritable: boolean = location!.match(/big-class/) && identity !== 'host' ? false : true;

    console.log(`[White] disableDeviceInputs, ${disableDeviceInputs}, disableOperations, ${disableOperations}, location: ${location}`);

    const room = await this.client.joinRoom({
      uuid,
      roomToken,
      disableBezier: true,
      disableDeviceInputs,
      disableOperations,
      // isWritable,
    }, {
      onPhaseChanged: (phase: RoomPhase) => {
        if (phase === RoomPhase.Connected) {
          this.updateLoading(false);
        } else {
          this.updateLoading(true);
        }
        console.log("[White] onPhaseChanged phase : ", phase);
      },
      onRoomStateChanged: state => {
        if (state.zoomScale) {
          whiteboard.updateScale(state.zoomScale);
        }
        if (state.sceneState) {
          whiteboard.updateRoomState();
        }
      },
      onDisconnectWithError: error => {},
      onKickedWithReason: reason => {},
      onKeyDown: event => {},
      onKeyUp: event => {},
      onHandToolActive: active => {},
      onPPTLoadProgress: (uuid: string, progress: number) => {},
    });

    await roomStore.updateWhiteboardUid(room.uuid);

    this.state = {
      ...this.state,
      room: room
    }
    this.commit(this.state);
  }

  cleanRoom () {
    this.state = {
      ...this.state,
      room: null
    }
    this.commit(this.state);
  }

  async leave() {
    if (!this.state.room) return;
    try {
      await this.state.room.disconnect();
    } catch(err) {
      console.warn('disconnect whiteboard failed', err);
    } finally {
      this.cleanRoom();
      console.log("cleanRoom");
    }
    this.updateLoading(true);
  }

  async destroy() {
    await this.leave();
    this.state = {
      ...this.defaultState,
    }
    this.commit(this.state);
    this.removeAllListeners();
  }

  private operator: any = null;

  async startRecording (token?: string) {
    if (!this.state) return;
    this.operator = new RecordOperator(
      {
        agoraAppId: APP_ID,
        customerId: process.env.REACT_APP_AGORA_CUSTOMER_ID as string,
        customerCertificate: process.env.REACT_APP_AGORA_CUSTOMER_CERTIFICATE as string,
        channelName: roomStore.state.course.rid,
        // WARN: here is cloud recording mode
        mode: 'mix',
        token,
        uid: `${RECORDING_UID}`,
      },
      {
        audioProfile: 1,
        transcodingConfig: {
            width: 240,
            height: 180,
            bitrate: 120,
            fps: 15,
            // "mixedVideoLayout": 1,
            // "maxResolutionUid": "1",
        },
      },
      {
          vendor: 2,
          region: handleRegion(process.env.REACT_APP_AGORA_OSS_BUCKET_REGION as string),
          bucket: process.env.REACT_APP_AGORA_OSS_BUCKET_NAME as string,
          accessKey: process.env.REACT_APP_AGORA_OSS_BUCKET_KEY as string,
          secretKey: process.env.REACT_APP_AGORA_OSS_BUCKET_SECRET as string,
      },
    );
    await this.operator.acquire();
    await this.operator.start();
    this.state = {
      ...this.state,
      recording: true,
      startTime: +Date.now(),
    };
    this.commit(this.state);
  }

  async stopRecording () {
    if (!this.state) return;
    await this.operator.query();
    const res = await this.operator.stop();
    const mediaUrl = get(res, 'serverResponse.fileList');
    this.state = {
      ...this.state,
      recording: false,
      endTime: +Date.now(),
    };
    this.commit(this.state);
    return mediaUrl;
  }

  clearRecording () {

    if (!this.state.room) {
      console.warn("whiteboard is released", this.state.room);
      throw 'whiteboard is released';
    }

    const endTime = this.state.endTime;
    const startTime = this.state.startTime;
    const roomUUID = this.state.room.uuid;
    this.state = {
      ...this.state,
      endTime: 0,
      startTime: 0,
      recording: false,
    }
    this.commit(this.state);

    return {endTime, startTime, roomUUID};
  }

  async lock() {
    const lockBoardStatus = Boolean(roomStore.state.me.lockBoard);
    const lockBoard = lockBoardStatus ? 0 : 1;
    if (lockBoard) {
      globalStore.showToast({
        type: 'notice-board',
        message: t('toast.whiteboard_lock')
      });
    } else {
      globalStore.showToast({
        type: 'notice-board',
        message: t('toast.whiteboard_unlock')
      });
    }
    await roomStore.updateMe({
      lockBoard
    });
  }
}

export const whiteboard = new Whiteboard();
//@ts-ignore
window.netlessStore = whiteboard;
