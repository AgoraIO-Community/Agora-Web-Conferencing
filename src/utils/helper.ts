import { RoomMessage } from './agora-rtm-client';
import * as _ from 'lodash';
import OSS from 'ali-oss';

export interface OSSConfig {
  accessKeyId: string,
  accessKeySecret: string,
  region: string,
  bucket: string,
  folder: string,
}

export const ossConfig: OSSConfig = {
  "accessKeyId": process.env.REACT_APP_AGORA_OSS_BUCKET_KEY as string,
  "accessKeySecret": process.env.REACT_APP_AGORA_OSS_BUCKET_SECRET as string,
  "bucket": process.env.REACT_APP_AGORA_OSS_BUCKET_NAME as string,
  "region": process.env.REACT_APP_AGORA_OSS_BUCKET_REGION as string,
  "folder": process.env.REACT_APP_AGORA_OSS_BUCKET_FOLDER as string
}

// export const ossClient = new OSS(ossConfig);
export const ossClient = undefined;

const OSS_PREFIX = process.env.REACT_APP_AGORA_RECORDING_OSS_URL as string;

export function getOSSUrl (mediaUrl: string): string {
  const res = `${OSS_PREFIX}/${mediaUrl}`;
  console.log("resolve: ", res, OSS_PREFIX);
  return res;
}

export const handleRegion = (region: string): number => {
  switch (region) {
    case "CN_Hangzhou":
      return 0;
    case "oss-cn-hangzhou":
      return 0;
    case "CN_Shanghai":
      return 1;
    case "oss-cn-shanghai":
      return 1;
    case "CN_Qingdao":
      return 2;
    case "oss-cn-qingdao":
      return 2;
    case "CN_Beijin":
      return 3;
    case "oss-cn-beijing":
      return 3;
    case "CN_Zhangjiakou":
      return 4;
    case "oss-cn-zhangjiakou":
      return 4;
    case "CN_Huhehaote":
      return 5;
    case "oss-cn-huhehaote":
      return 5;
    case "CN_Shenzhen":
      return 6;
    case "oss-cn-shenzhen":
      return 6;
    case "CN_Hongkong":
      return 7;
    case "oss-cn-hongkong":
      return 7;
    case "US_West_1":
      return 8;
    case "oss-us-west-1":
      return 8;
    case "US_East_1":
      return 9;
    case "oss-us-east-1":
      return 9;
    case "AP_Southeast_1":
      return 10;
    case "oss-ap-southeast-1":
      return 10;
    case "AP_Southeast_2":
      return 11;
    case "oss-ap-southeast-2":
      return 11;
    case "AP_Southeast_3":
      return 12;
    case "oss-ap-southeast-3":
      return 12;
    case "AP_Southeast_5":
      return 13;
    case "oss-ap-southeast-5":
      return 13;
    case "AP_Northeast_1":
      return 14;
    case "oss-ap-northeast-1":
      return 14;
    case "AP_South_1":
      return 15;
    case "oss-ap-south-1":
      return 15;
    case "EU_Central_1":
      return 16;
    case "oss-eu-central-1":
      return 16;
    case "EU_West_1":
      return 17;
    case "oss-eu-west-1":
      return 17;
    case "EU_East_1":
      return 18;
    case "oss-me-east-1":
      return 18;
    default:
      return 0;
  }
}

export function resolveMessage(peerId: string, { cmd, text }: { cmd: number, text?: string }) {
  let type = '';
  switch (cmd) {
    case RoomMessage.acceptCoVideo:
      type = 'accept co-video'
      break;
    case RoomMessage.rejectCoVideo:
      type = 'reject co-video'
      break;
    case RoomMessage.cancelCoVideo:
      type = 'cancel co-video'
      break;
    case RoomMessage.applyCoVideo:
      type = 'apply co-video'
      break;
    case RoomMessage.muteVideo:
      type = 'mute video'
      break;
    case RoomMessage.muteAudio:
      type = 'mute audio'
      break;
    case RoomMessage.unmuteAudio:
      type = 'unmute audio'
      break;
    case RoomMessage.unmuteVideo:
      type = 'unmute video'
      break;
    default:
      return console.warn(`[RoomMessage] unknown type, from peerId: ${peerId}`);
  }
  console.log(`[RoomMessage] [${type}] from peerId: ${peerId}`)
}

export interface UserAttrs {
  uid: string
  account: string
  role: string
  audio: number
  video: number
  chat: number
  whiteboard_uid?: string
  link_uid?: number
  shared_uid?: number
  mute_chat?: number
  class_state?: number
}

export function resolveMediaState(body: any) {
  const cmd: number = body.cmd;
  const mediaState = {
    key: 'unknown',
    val: -1,
  }
  switch (cmd) {
    case RoomMessage.muteVideo:
      mediaState.key = 'video'
      mediaState.val = 0
      break
    case RoomMessage.unmuteVideo:
      mediaState.key = 'video'
      mediaState.val = 1
      break
    case RoomMessage.muteAudio:
      mediaState.key = 'audio'
      mediaState.val = 0
      break
    case RoomMessage.unmuteAudio:
      mediaState.key = 'audio'
      mediaState.val = 1
      break
    case RoomMessage.muteChat:
      mediaState.key = 'chat'
      mediaState.val = 0
      break
    case RoomMessage.unmuteChat:
      mediaState.key = 'chat'
      mediaState.val = 1
      break
    default:
      console.warn("[rtm-message] unknown message protocol");
  }
  return mediaState;
}

export function genUid(): string {
  const id = +Date.now() % 1000000;
  return id.toString();
}

export function jsonParse(json: string) {
  try {
    return JSON.parse(json);
  } catch (err) {
    return {};
  }
}

export function resolvePeerMessage(text: string) {
  const body = jsonParse(text);
  return body;
}

export const resolveFileInfo = (file: any) => {
  const fileName = encodeURI(file.name);
  const fileType = fileName.substring(fileName.length, fileName.lastIndexOf('.'));
  return {
    fileName,
    fileType
  }
}

const level = [
  'unknown',
  'excellent',
  'good',
  'poor',
  'bad',
  'very bad',
  'down'
];

export function NetworkQualityEvaluation(evt: { downlinkNetworkQuality: number, uplinkNetworkQuality: number }) {
  let defaultQuality = 'unknown';
  const val = Math.max(evt.downlinkNetworkQuality, evt.uplinkNetworkQuality);
  return level[val] ? level[val] : defaultQuality;
}

export function btoa(input: any) {
  let keyStr =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let output = "";
  let chr1, chr2, chr3, enc1, enc2, enc3, enc4;
  let i = 0;

  while (i < input.length) {
    chr1 = input[i++];
    chr2 = i < input.length ? input[i++] : Number.NaN; // Not sure if the index
    chr3 = i < input.length ? input[i++] : Number.NaN; // checks are needed here

    enc1 = chr1 >> 2;
    enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
    enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
    enc4 = chr3 & 63;

    if (isNaN(chr2)) {
      enc3 = enc4 = 64;
    } else if (isNaN(chr3)) {
      enc4 = 64;
    }
    output +=
      keyStr.charAt(enc1) +
      keyStr.charAt(enc2) +
      keyStr.charAt(enc3) +
      keyStr.charAt(enc4);
  }
  return output;
}