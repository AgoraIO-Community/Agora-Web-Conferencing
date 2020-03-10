import { platform } from './../utils/platform';
import { AgoraElectronClient } from './../utils/agora-electron-client';
import { ChatMessage, AgoraStream } from '../utils/types';
import { Subject } from 'rxjs';
import { Map, Set, List } from 'immutable';
import AgoraRTMClient, { RoomMessage } from '../utils/agora-rtm-client';
import { globalStore } from './global';
import AgoraWebClient from '../utils/agora-rtc-client';
import { get, set, isEmpty } from 'lodash';
import { isElectron } from '../utils/platform';
import GlobalStorage from '../utils/custom-storage';
import { t } from '../i18n';
import { jsonParse } from '../utils/helper';

function canJoin({ onlineStatus, roomType, channelCount, role }: { onlineStatus: any, role: string, channelCount: number, roomType: number }) {
  const result = {
    permitted: true,
    reason: ''
  }
  const channelCountLimit = [2, 17, Infinity];

  let maximum = channelCountLimit[roomType];
  if (channelCount >= maximum) {
    result.permitted = false;
    result.reason = t('toast.teacher_and_student_over_limit');
    return result;
  }

  const teacher = get(onlineStatus, 'teacher', false);
  const studentsTotalCount: number = get(onlineStatus, 'studentsTotalCount', 0);

  if (role === 'teacher') {
    const isOnline = teacher;
    if (isOnline) {
      result.permitted = false;
      result.reason = t('toast.teacher_exists');
      return result;
    }
  }

  if (role === 'student') {
    if (studentsTotalCount >= maximum - 1) {
      result.permitted = false;
      result.reason = t('toast.student_over_limit');
      return result;
    }
  }

  return result;
}

export type LocalAttrs = Partial<AgoraUser & ClassState>;

export type ChannelAttrs = {
  uid: string
  account: string
  role: string
  video: number
  audio: number
  chat: number
  class_state?: number
  mute_chat?: number
  whiteboard_uid: string
  shared_uid: number 
  link_uid: number
  lock_board?: number
  grant_board: number
};
export interface AgoraUser {
  uid: string
  account: string
  role: string
  video: number
  audio: number
  chat: number
  boardId: string // whiteboard_uuid
  sharedId: number // shared_uid
  linkId: number // link_uid
  lockBoard: number // lock_board
  grantBoard: number
}

export interface ClassState {
  rid: string
  roomName: string
  teacherId: string
  roomType: number
  boardId: string // whiteboard_uuid
  sharedId: number // shared_uid
  linkId: number // link_uid
  lockBoard: number // lock_board
  courseState: number
  muteChat: number
}

type RtcState = {
  published: boolean
  joined: boolean
  users: Set<number>
  shared: boolean
  localStream: AgoraMediaStream | null
  localSharedStream: AgoraMediaStream | null
  remoteStreams: Map<number, AgoraMediaStream>
}

export type MediaDeviceState = {
  microphoneId: string
  speakerId: string
  cameraId: string
  speakerVolume: number
  camera: number
  microphone: number
  speaker: number
}

export type SessionInfo = {
  uid: string
  rid: string
  account: string
  roomName: string
  roomType: number
  role: string
}

export type RtmState = {
  joined: boolean
  memberCount: number
}

export type RoomState = {
  rtmLock: boolean
  rtmToken: string
  rtcToken: string
  me: AgoraUser
  users: Map<string, AgoraUser>
  course: ClassState
  applyUid: number
  rtc: RtcState
  rtm: RtmState
  mediaDevice: MediaDeviceState
  messages: List<ChatMessage>
  language: string
}

export type AgoraMediaStream = {
  streamID: number
  stream?: any
}

export class RoomStore {
  private subject: Subject<RoomState> | null;
  public _state: RoomState;

  get state() {
    return this._state;
  }

  set state(newState) {
    this._state = newState;
  }
  public readonly defaultState: RoomState = Object.freeze({
    rtmLock: false,
    rtcToken: '',
    rtmToken: '',
    me: {
      account: "",
      uid: "",
      role: "",
      video: 1,
      audio: 1,
      chat: 1,
      linkId: 0,
      sharedId: 0,
      boardId: '',
      lockBoard: 0,
      grantBoard: 0,
    },
    users: Map<string, AgoraUser>(),
    applyUid: 0,
    rtm: {
      joined: false,
      memberCount: 0,
    },
    rtc: {
      published: false,
      joined: false,
      shared: false,
      users: Set<number>(),
      localStream: null,
      localSharedStream: null,
      remoteStreams: Map<number, AgoraMediaStream>(),
    },
    course: {
      teacherId: '',
      boardId: '',
      sharedId: 0,
      linkId: 0,
      courseState: 0,
      muteChat: 0,
      rid: '',
      roomName: '',
      roomType: 0,
      lockBoard: 0,
    },
    mediaDevice: {
      microphoneId: '',
      speakerId: '',
      cameraId: '',
      speakerVolume: 100,
      camera: 0,
      speaker: 0,
      microphone: 0
    },
    messages: List<ChatMessage>(),
    language: navigator.language,
    ...GlobalStorage.read('agora_room')
  });

  private applyLock: number = 0;

  public windowId: number = 0;

  // public rtmClient: AgoraRTMClient = new AgoraRTMClient();
  // public rtcClient: AgoraWebClient | AgoraElectronClient = isElectron ? new AgoraElectronClient() : new AgoraWebClient();

  public rtmClient: AgoraRTMClient;
  public rtcClient: AgoraWebClient | AgoraElectronClient;

  constructor() {
    this.subject = null;
    this._state = {
      ...this.defaultState
    };
    this.rtmClient = new AgoraRTMClient();
    this.rtcClient = isElectron ? new AgoraElectronClient ({roomStore: this}) : new AgoraWebClient({roomStore: this});
  }

  initialize() {
    this.subject = new Subject<RoomState>();
    this.state = {
      ...this.defaultState,
    }
    this.applyLock = 0;
    this.subject.next(this.state);
  }

  get applyUid() {
    return this.applyLock;
  }

  subscribe(updateState: any) {
    this.initialize();
    this.subject && this.subject.subscribe(updateState);
  }

  unsubscribe() {
    this.subject && this.subject.unsubscribe();
    this.subject = null;
  }

  commit(state: RoomState) {
    this.subject && this.subject.next(state);
  }

  updateState(rootState: RoomState) {
    this.state = {
      ...this.state,
      ...rootState,
    }
    this.commit(this.state);
  }

  isTeacher(peerId: string) {
    if (!peerId
      || !this.state.course.teacherId
      || this.state.course.teacherId !== peerId
    ) return false;
    return true;
  }

  isStudent(peerId: string) {
    if (!peerId
      || this.state.course.teacherId === peerId
    ) return false;

    return true;
  }

  addLocalStream(stream: AgoraStream) {
    this.state = {
      ...this.state,
      rtc: {
        ...this.state.rtc,
        localStream: stream
      }
    }
    this.commit(this.state);
  }

  removeLocalStream() {
    this.state = {
      ...this.state,
      rtc: {
        ...this.state.rtc,
        localStream: null,
        localSharedStream: null
      }
    }
    this.commit(this.state);
  }

  addLocalSharedStream(stream: any) {
    this.state = {
      ...this.state,
      rtc: {
        ...this.state.rtc,
        localSharedStream: stream
      }
    }
    this.commit(this.state);
  }

  removeLocalSharedStream() {
    this.state = {
      ...this.state,
      rtc: {
        ...this.state.rtc,
        localSharedStream: null
      }
    }
    this.commit(this.state);
  }

  addPeerUser(uid: number) {
    this.state = {
      ...this.state,
      rtc: {
        ...this.state.rtc,
        users: this.state.rtc.users.add(uid),
      }
    }
    this.commit(this.state);
  }

  removePeerUser(uid: number) {
    this.state = {
      ...this.state,
      rtc: {
        ...this.state.rtc,
        users: this.state.rtc.users.delete(uid),
      }
    }
    this.commit(this.state);
  }

  addRemoteStream(stream: AgoraStream) {
    this.state = {
      ...this.state,
      rtc: {
        ...this.state.rtc,
        remoteStreams: this.state.rtc.remoteStreams.set(stream.streamID, stream)
      }
    }
    this.commit(this.state);
  }

  removeRemoteStream(uid: number) {
    const remoteStream = this.state.rtc.remoteStreams.get(uid);
    if (platform === 'web') {
      if (remoteStream && remoteStream.stream && remoteStream.stream.isPlaying) {
        remoteStream.stream.isPlaying() && remoteStream.stream.stop();
      }
    }

    this.state = {
      ...this.state,
      rtc: {
        ...this.state.rtc,
        remoteStreams: this.state.rtc.remoteStreams.delete(uid)
      }
    }
    this.commit(this.state);
  }

  updateMemberCount(count: number) {
    this.state = {
      ...this.state,
      rtm: {
        ...this.state.rtm,
        memberCount: count,
      }
    }
    this.commit(this.state);
  }

  updateRtc(newState: any) {
    this.state = {
      ...this.state,
      rtc: {
        ...this.state.rtc,
        ...newState,
      }
    }
    this.commit(this.state);
  }

  updateDevice(state: MediaDeviceState) {
    this.state = {
      ...this.state,
      mediaDevice: state
    }
    this.commit(this.state);
  }

  async handlePeerMessage(cmd: RoomMessage, peerId: string) {
    if (!peerId) return console.warn('state is not assigned');
    const myUid = this.state.me.uid;
    console.log("Teacher: ", this.isTeacher(myUid), ", peerId: ", this.isStudent(peerId));
    // student follow teacher peer message
    if (!this.isTeacher(myUid) && this.isTeacher(peerId)) {

      const me = this.state.me;
      switch (cmd) {
        case RoomMessage.muteChat: {
          return await this.updateMe({ chat: 0 });
        }
        case RoomMessage.muteAudio: {
          return await this.updateMe({ audio: 0 });
        }
        case RoomMessage.muteVideo: {
          return await this.updateMe({ video: 0 });
        }
        case RoomMessage.muteBoard: {
          globalStore.showToast({
            type: 'notice',
            message: t('toast.teacher_cancel_whiteboard'),
          });
          return await this.updateMe({ grantBoard: 0 });
        }
        case RoomMessage.unmuteAudio: {
          return await this.updateMe({ audio: 1 });
        }
        case RoomMessage.unmuteVideo: {
          return await this.updateMe({ video: 1 });
        }
        case RoomMessage.unmuteChat: {
          return await this.updateMe({ chat: 1 });
        }
        case RoomMessage.unmuteBoard: {
          globalStore.showToast({
            type: 'notice',
            message: t('toast.teacher_accept_whiteboard')
          });
          return await this.updateMe({ grantBoard: 1 });
        }
        case RoomMessage.acceptCoVideo: {
          globalStore.showToast({
            type: 'co-video',
            message: t("toast.teacher_accept_co_video")
          });
          return;
        }
        case RoomMessage.rejectCoVideo: {
          globalStore.showToast({
            type: 'co-video',
            message: t("toast.teacher_reject_co_video")
          });
          return;
        }
        case RoomMessage.cancelCoVideo: {
          globalStore.showToast({
            type: 'co-video',
            message: t("toast.teacher_cancel_co_video")
          });
          return;
        }
        default:
      }
      return;
    }

    // when i m teacher & received student message
    if (this.isTeacher(myUid) && this.isStudent(peerId)) {
      switch (cmd) {
        case RoomMessage.applyCoVideo: {
          // WARN: LOCK
          if (this.state.course.linkId) {
            return console.warn('already received apply id: ', this.applyLock);
          }
          const applyUser = roomStore.state.users.get(`${peerId}`);
          if (applyUser) {
            this.applyLock = +peerId;
            console.log("applyUid: ", this.applyLock);
            this.state = {
              ...this.state,
              applyUid: this.applyLock,
            }
            this.commit(this.state);
            globalStore.showNotice({
              reason: 'peer_hands_up',
              text: t('notice.student_interactive_apply', { reason: applyUser.account }),
            });
          }
          return;
        }
        case RoomMessage.cancelCoVideo: {
          // WARN: LOCK
          if (this.state.course.linkId && `${this.state.course.linkId}` === peerId) {
            roomStore.updateCourseLinkUid(0).then(() => {
            }).catch(console.warn);

            globalStore.showToast({
              type: 'co-video',
              message: t('toast.student_cancel_co_video')
            });
          }
          return;
        }
        default:
      }
      return;
    }
  }

  async mute(uid: string, type: string) {
    const me = this.state.me;
    if (me.uid === `${uid}`) {
      if (type === 'audio') {
        await this.updateMe({
          audio: 0
        });
      }
      if (type === 'video') {
        await this.updateMe({
          video: 0
        });
      }
      if (type === 'chat') {
        await this.updateMe({
          chat: 0
        });
      }
      // if (type === 'grantBoard') {
      //   await this.updateMe({
      //     grant_board: 0
      //   });
      // }
    }
    else if (me.role === 'teacher') {
      if (type === 'audio') {
        await this.rtmClient.sendPeerMessage(`${uid}`, { cmd: RoomMessage.muteAudio });
      }
      if (type === 'video') {
        await this.rtmClient.sendPeerMessage(`${uid}`, { cmd: RoomMessage.muteVideo });
      }
      if (type === 'chat') {
        await this.rtmClient.sendPeerMessage(`${uid}`, { cmd: RoomMessage.muteChat });
      }
      if (type === 'grantBoard') {
        await this.rtmClient.sendPeerMessage(`${uid}`, { cmd: RoomMessage.muteBoard });
      }
    }
  }

  async unmute(uid: string, type: string) {
    const me = this.state.me;
    if (me.uid === `${uid}`) {
      if (type === 'audio') {
        await this.updateMe({
          audio: 1
        });
      }
      if (type === 'video') {
        await this.updateMe({
          video: 1
        });
      }
      if (type === 'chat') {
        await this.updateMe({
          chat: 1
        });
      }
      // if (type === 'grantBoard') {
      //   await this.updateMe({
      //     grant_board: 1
      //   });
      // }
    }
    else if (me.role === 'teacher') {
      if (type === 'audio') {
        await this.rtmClient.sendPeerMessage(`${uid}`, { cmd: RoomMessage.unmuteAudio });
      }
      if (type === 'video') {
        await this.rtmClient.sendPeerMessage(`${uid}`, { cmd: RoomMessage.unmuteVideo });
      }
      if (type === 'chat') {
        await this.rtmClient.sendPeerMessage(`${uid}`, { cmd: RoomMessage.unmuteChat });
      }
      if (type === 'grantBoard') {
        await this.rtmClient.sendPeerMessage(`${uid}`, { cmd: RoomMessage.unmuteBoard });
      }
    }
  }

  async loginAndJoin(payload: any, pass: boolean = false) {
    const { roomType, role, uid, rid, rtmToken } = payload;
    console.log("payload: ", payload);
    let result = { permitted: true, reason: '' };
    await this.rtmClient.login(uid, rtmToken);
    try {
      const channelMemberCount = await this.rtmClient.getChannelMemberCount([rid]);
      const channelCount = channelMemberCount[rid];
      let accounts = await this.rtmClient.getChannelAttributeBy(rid);
      const onlineStatus = await this.rtmClient.queryOnlineStatusBy(accounts);
      console.log("onlineStatus", onlineStatus);
      const argsJoin = {
        channelCount,
        onlineStatus,
        role,
        accounts,
        roomType
      };
      result = pass === false ? canJoin(argsJoin) : { permitted: true, reason: '' };
      if (result.permitted) {
        let res = await this.rtmClient.join(rid);
        const grantBoard = role === 'teacher' ? 1 : 0;
        await this.updateMe({ ...payload, grantBoard });
        this.state = {
          ...this.state,
          rtm: {
            ...this.state.rtm,
            joined: true
          },
        }
        console.log("loginAndJoin>>>>: accounts", accounts);
        this.commit(this.state);
        return;
      }
      throw {
        type: 'not_permitted',
        reason: result.reason
      }
    } catch (err) {
      if (this.rtmClient._logged) {
        await this.rtmClient.logout();
      }
      throw err;
    }
  }

  setRTCJoined(joined: boolean) {
    this.state = {
      ...this.state,
      rtc: {
        ...this.state.rtc,
        joined
      }
    }
    this.commit(this.state);
  }

  async updateCourseLinkUid(linkId: number) {
    const me = this.state.me;
    console.log("me: link_uid", me, linkId);
    let res = await this.updateMe({
      linkId,
    })
    this.applyLock = linkId;
    console.log("current apply lock: ", this.applyLock);
    return res;
  }

  async updateWhiteboardUid(boardId: string) {
    let res = await this.updateMe({
      boardId
    });
    console.log("[update whiteboard uuid] res", boardId);
    return res;
  }

  updateChannelMessage(msg: ChatMessage) {
    this.state = {
      ...this.state,
      messages: this.state.messages.push(msg)
    };

    this.commit(this.state);
  }

  private compositeMe(params: Partial<AgoraUser>): AgoraUser {
    console.log("compositeMe: ", params);
    const newMe: AgoraUser = { ...this.state.me };
    for (const prop in params) {
      if (newMe.hasOwnProperty(prop) && params.hasOwnProperty(prop)) {
        set(newMe, prop, get(params, prop, ''));
      }
    }
    return newMe;
  }

  private compositeCourse(params: Partial<ClassState>): ClassState {
    console.log("compositeCourse: ", params);
    const newCourse = { ...this.state.course };
    for (const prop in params) {
      if (newCourse.hasOwnProperty(prop) && params.hasOwnProperty(prop)) {
        set(newCourse, prop, get(params, prop, ''));
      }
    }
    return newCourse;
  }

  private exactChannelAttrsBy(me: AgoraUser, course: ClassState): ChannelAttrs {
    console.log("origin: ", me, course);
    const newChannelAttrs: ChannelAttrs = {
      uid: me.uid,
      account: `${me.account}`,
      role: `${me.role}`,
      video: +me.video,
      audio: +me.audio,
      chat: +me.chat,
      whiteboard_uid: me.boardId,
      shared_uid: me.sharedId,
      link_uid: +me.linkId,
      lock_board: +me.lockBoard,
      grant_board: +me.grantBoard,
    }

    if (!course.boardId && me.boardId) {
      newChannelAttrs.whiteboard_uid = me.boardId;
    }

    if (me.role === 'teacher') {
      newChannelAttrs.lock_board = course.lockBoard;
      newChannelAttrs.class_state = course.courseState;
      newChannelAttrs.mute_chat = course.muteChat;
    }

    return newChannelAttrs;
  }

  async updateMe(params: LocalAttrs) {
    const newMe = this.compositeMe(params);
    const newCourse = this.compositeCourse(params);
    const {
      role,
      uid,
    } = newMe;

    const channelKey: string = role === 'teacher' ? 'teacher' : `${uid}`;

    if (role === 'teacher') {
      newCourse.teacherId = uid;
    }

    const channelAttrs = this.exactChannelAttrsBy(newMe, newCourse);
    this.state = {
      ...this.state,
      me: {
        ...newMe,
      },
      users: this.state.users.set(newMe.uid, {
        ...newMe
      }),
      course: {
        ...newCourse,
      }
    }
    this.commit(this.state);
    let res = await this.rtmClient.updateChannelAttrsByKey(channelKey, channelAttrs);
    return res;
  }

  private exactChannelAttrsFrom(json: object) {
    const defaultCourseState = {
      class_state: 0,
      link_uid: 0,
      shared_uid: 0,
      mute_chat: 0,
      whiteboard_uid: 0,
      lock_board: 0,
      // grant_board: 0,
    }

    const AgoraUserKeys: string[] = [
      'uid',
      'account',
      'role',
      'video',
      'audio',
      'chat',
      'whiteboard_uid',
      'shared_uid',
      'mute_chat',
      'link_uid',
      'class_state',
      'grant_board',
      'lock_board'
    ];
    const teacherJson = jsonParse(get(json, 'teacher.value'));
    const course: any = {};
    if (teacherJson) {
      for (const prop in teacherJson) {
        if (defaultCourseState.hasOwnProperty(prop)) {
          course[prop] = teacherJson[prop];
        }
      }
    }

    const students = [];
    for (let key of Object.keys(json)) {
      if (key === 'teacher') continue;
      const student = jsonParse(get(json, `${key}.value`));
      if (!isEmpty(student)) {
        student.uid = key;
        students.push(Object.freeze(student));
        // console.log(">>> parse, student: ", student);
      }
    }

    const accounts = [];
    if (!isEmpty(teacherJson)) {
      const teacher: any = { role: 'teacher' };
      for (const prop of AgoraUserKeys) {
        if (teacherJson.hasOwnProperty(prop)) {
          teacher[prop] = teacherJson[prop]
        }
      }
      accounts.push(teacher);
    }
    for (let student of students) {
      if (!isEmpty(student)) {
        const tempStudent: any = { role: 'student' };
        for (const prop of AgoraUserKeys) {
          if (student.hasOwnProperty(prop)) {
            tempStudent[prop] = student[prop]
          }
        }
        accounts.push(tempStudent);
      }
    }
    return {
      teacher: teacherJson,
      students: students,
      accounts,
      course,
    };
  }

  updateRoomAttrs(rawData: object) {
    const {
      teacher,
      accounts,
      course: room
    } = this.exactChannelAttrsFrom(rawData);

    console.log("origin", rawData);
    console.log("origin exact", teacher, accounts, room);
    const users = accounts.reduce((acc: Map<string, AgoraUser>, it: any) => {
      return acc.set(it.uid, {
        role: it.role,
        account: it.account,
        uid: it.uid,
        video: it.video,
        audio: it.audio,
        chat: it.chat,
        boardId: it.whiteboard_uid,
        sharedId: it.shared_uid,
        linkId: it.link_uid,
        lockBoard: it.lock_board,
        grantBoard: it.grant_board
      });
    }, Map<string, AgoraUser>());

    const newClassState: Partial<ClassState> = {
      teacherId: get(teacher, 'uid', 0),
      linkId: room.link_uid,
      boardId: room.whiteboard_uid,
      courseState: room.class_state,
      muteChat: room.mute_chat,
      lockBoard: room.lock_board
    };

    const me = this.state.me;
    let newMeValue: Partial<AgoraUser> = {};

    if (users.get(me.uid)) {
      newMeValue = users.get(me.uid) as AgoraUser;
    } else {
      newMeValue = me;
    }

    const newMe = this.compositeMe(newMeValue);
    users.set(newMe.uid, {...newMe});
    const newCourse = this.compositeCourse(newClassState);

    this.state = {
      ...this.state,
      users,
      me: {
        ...this.state.me,
        ...newMe,
      },
      course: {
        ...this.state.course,
        ...newCourse
      }
    }
    this.commit(this.state);
  }

  async exitAll() {
    try {
      try {
        await this.rtmClient.exit();
      } catch (err) {
        console.warn(err);
      }
      try {
        await this.rtcClient.exit();
      } catch (err) {
        console.warn(err);
      }
    } finally {
      GlobalStorage.clear('agora_room');
      this.state = {
        ...this.defaultState
      }
      this.commit(this.state);
    }
  }

  setScreenShare(shared: boolean) {
    this.state = {
      ...this.state,
      rtc: {
        ...this.state.rtc,
        shared,
      }
    }
    this.commit(this.state);
  }
}

export const roomStore = new RoomStore();

//@ts-ignore
window.roomStore = roomStore;