import { AgoraFetch } from "../utils/fetch";

const ENDPOINT: string = process.env.REACT_APP_AGORA_ENDPOINT as string;

const AUTHORIZATION_KEY: string = process.env.REACT_APP_AGORA_ENDPOINT_AK as string;

const AgoraFetchJson = async ({url, method, data, token}:{url: string, method: string, data?: any, token?: string}) => {
  const opts: any = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': AUTHORIZATION_KEY
    }
  }

  if (data) {
    opts.body = JSON.stringify(data);
  }

  if (token) {
    opts.token = token;
  }

  let resp = await AgoraFetch(`${url}`, opts);
  return resp.json();
}

export interface EntryParams {
  userName: string
  roomName: string
  type: number
  role: number
}

export interface RoomParams {
  muteAllChat: boolean
  userId: number
  enableChat: number
  enableVideo: number
  enableAudio: number
  linkUsers: number[]
}

export class EndPoint {

  appID: string = '';
  roomId: string = '';
  userToken: string = '';
  recordId: string = '';

  async config() {
    let json = await AgoraFetchJson({
      url: `${ENDPOINT}/v1/room/config`,
      method: 'GET',
    });
    this.appID = json.data.appId;
    return {
      code: json.code,
      appId: json.data.appId,
      room: json.data.room,
    }
  }

  /**
   * entry
   * @param params {@link EntryParams}
   */
  async entry(params: EntryParams) {
    let json = await AgoraFetchJson({
      url: `${ENDPOINT}/v1/apps/${this.appID}/room/entry`,
      method: 'POST',
      data: params
    });
    
    this.roomId = json.data.room.roomId;
    this.userToken = json.data.user.userToken;
    return {
      code: json.code,
      msg: json.msg,
      data: json.data,
    }
  }

  /**
   * refreshToken
   */
  async refreshToken() {
    let json = await AgoraFetchJson({
      url: `${ENDPOINT}/v1/apps/${this.appID}/room/${this.roomId}/token/refresh`,
      method: 'POST',
      token: this.userToken,
    });
    return {
      code: json.code,
      msg: json.msg,
      data: json.data
    }
  }

  /**
   * updateRoom
   * @param params 
   */
  async updateRoom(params: RoomParams) {
    let json = await AgoraFetchJson({
      url: `${ENDPOINT}/v1/apps/${this.appID}/room/${this.roomId}`,
      method: 'POST',
      data: params,
      token: this.userToken,
    });
    return {
      code: json.code,
      msg: json.msg,
      data: json.data
    }
  }

  /**
   * start recording
   */
  async startRecording() {
    let json = await AgoraFetchJson({
      url: `${ENDPOINT}/v1/apps/${this.appID}/room/${this.roomId}/record`,
      method: 'POST',
      token: this.userToken,
    });
    this.recordId = json.data;
    return {
      code: json.code,
      data: json.data,
      msg: json.msg
    }
  }

  /**
   * stop recording
   */
  async stopRecording() {
    let json = await AgoraFetchJson({
      url: `${ENDPOINT}/v1/apps/${this.appID}/room/${this.roomId}/${this.recordId}/stop`,
      method: 'POST',
      token: this.userToken,
    })
    return {
      code: json.code,
      data: json.data,
      msg: json.msg
    }
  }

  /**
   * get recording list
   */
  async getRecordingList () {
    let json = await AgoraFetchJson({
      url: `${ENDPOINT}/v1/apps/${this.appID}/room/${this.roomId}/records`,
      method: 'GET'
    })
    return {
      code: json.code,
      data: json.data,
      msg: json.msg,
    }
  }

  /**
   * getRoomInfo
   */
  async getRoomInfoBy() {
    let json = await AgoraFetchJson({
      url: `${ENDPOINT}/v1/apps/${this.appID}/room/${this.roomId}`,
      method: 'GET',
    });
    return {
      code: json.code,
      msg: json.msg,
      data: json.data
    }
  }

}