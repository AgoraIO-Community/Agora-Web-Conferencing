import {get} from 'lodash';
import { WhiteWebSdk, ReplayRoomParams, PlayerCallbacks } from 'white-web-sdk';
import { AgoraFetch } from '../fetch';

const createRoomApi = process.env.REACT_APP_NETLESS_APP_API_ENTRY as string;
const joinRoomApi = process.env.REACT_APP_NETLESS_APP_JOIN_API;
const sdkToken = process.env.REACT_APP_NETLESS_APP_TOKEN;

export const WhiteboardAPI = {
  async createRoom ({rid, limit, mode}: any) {
    let response = await AgoraFetch(`${createRoomApi}${sdkToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: rid,
        limit,
        mode
      })
    });
    let json = await response.json();
    return {
      uuid: get(json, 'msg.room.uuid'),
      roomToken: get(json, 'msg.roomToken')
    }
  },

  async joinRoom (uuid: string, rid?: string): Promise<any> {
    let response = await AgoraFetch(
      `${joinRoomApi}${sdkToken}&uuid=${uuid}`, {
        method: 'POST',
        headers: {
          "content-type": "application/json",
        }
      }
    );
    let json = await response.json();
    return {
      uuid: uuid,
      roomToken: get(json, 'msg.roomToken')
    }
  },

  async replayRoom(client: WhiteWebSdk, args: ReplayRoomParams, callback: PlayerCallbacks) {
    let retrying;
    do {
      try {
        let result = await client.replayRoom({
          beginTimestamp: args.beginTimestamp,
          duration: args.duration,
          room: args.room,
          mediaURL: args.mediaURL,
          roomToken: args.roomToken,
        }, callback);
        retrying = false;
        return result;
      } catch (err) {
        retrying = true;
      }
    } while (retrying);
  }
}