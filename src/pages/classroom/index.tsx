import React, { useEffect, useMemo, useRef } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import Nav from '../../components/nav';
import RoomDialog from '../../components/dialog/room';
import { AgoraStream } from '../../utils/types';
import './room.scss';
import NativeSharedWindow from '../../components/native-shared-window';
import { roomStore } from '../../stores/room';
import { useRoomState } from '../../containers/root-container';
import { globalStore } from '../../stores/global';
import { platform } from '../../utils/platform';
import AgoraWebClient, { AgoraStreamSpec, SHARE_ID } from '../../utils/agora-rtc-client';
import { AgoraElectronClient } from '../../utils/agora-electron-client';
import { t } from '../../i18n';

export const roomTypes = [
  {value: 0, text: 'One-on-One', path: 'one-to-one'},
  {value: 1, text: 'Small Class', path: 'live'},
  {value: 2, text: 'Large Class', path: 'big-class'},
];

export function RoomPage({ children }: any) {

  const history = useHistory();

  const lock = useRef<boolean>(false);

  useEffect(() => {

    const me = roomStore.state.me;
    const {
      rid,
      roomType,
      roomName,
      lockBoard,
      linkId,
    } = roomStore.state.course;

    const {rtmToken, rtcToken} = roomStore.state;

    if (!rid || !me.uid) {
      history.push('/');
    }

    const uid = me.uid;

    const payload = {
      // course state
      rid,
      roomName,
      roomType,
      lockBoard,
      rtmToken,
      rtcToken,
      // TODO
      linkId: linkId,
      // agora user attributes
      uid,
      role: me.role,
      video: me.video,
      audio: me.audio,
      chat: me.chat,
      account: me.account,
      boardId: me.boardId,
      sharedId: me.sharedId,
      grantBoard: me.grantBoard,
    }
    lock.current = true;
    if (roomStore.state.rtm.joined) return;
    globalStore.showLoading();
    roomStore.loginAndJoin(payload, true).then(() => {
      console.log('[biz-login]  loginAndJoin, success: ', JSON.stringify(payload));
    }).catch((err: any) => {
      globalStore.showToast({
        type: 'rtmClient',
        message: t('toast.login_failure'),
      });
      history.push('/');
      console.warn(err)
    })
    .finally(() => {
      globalStore.stopLoading();
      lock.current = false;
    });
  }, []);

  const roomType = roomTypes[roomStore.state.course.roomType];

  const location = useLocation();

  const roomState = useRoomState();
  const me = roomStore.state.me;
  const course = roomStore.state.course;
  const classroom = Boolean(location.pathname.match(/meeting/));
  const isBigClass = Boolean(location.pathname.match(/big-class/));
  const isSmallClass = Boolean(location.pathname.match(/live/));
  
  useEffect(() => {
    return () => {
      globalStore.removeUploadNotice();
      roomStore.exitAll()
      .then(() => {
      })
      .catch(console.warn)
      .finally(() => {
      });
    }
  }, [location]);
  
  const rtc = useRef<boolean>(false);

  const canPublish = useMemo(() => {
    return !isBigClass ||
      (isBigClass && 
        (me.role === 'teacher' ||
          +me.uid === +course.linkId));
  }, [me.uid, course.linkId, me.role, isBigClass]);

  useEffect(() => {
    return () => {
      rtc.current = true
    }
  },[]);

  const publishLock = useRef<boolean>(false);

  const {rtcJoined, uid, role, mediaDevice} = useMemo(() => {
    return {
      rtcJoined: roomState.rtc.joined,
      uid: roomState.me.uid,
      role: roomState.me.role,
      mediaDevice: roomState.mediaDevice,
    }
  }, [roomState]);

  useEffect(() => {
    if (!location.pathname.match(/big-class/) || me.role === 'teacher') return
    if (course.linkId) return;
    const rtcClient = roomStore.rtcClient;
    if (platform === 'web') {
      const webClient = rtcClient as AgoraWebClient;
      if (!webClient.published) return;
      webClient
        .unpublishLocalStream()
        .then(() => {
          console.log("[agora-web] unpublish local stream");
        }).catch(console.warn)
    }

    if (platform === 'electron') {
      const nativeClient = rtcClient as AgoraElectronClient;
      if (!nativeClient.published) return;
      nativeClient.unpublish();
    }

  }, [me.role, location.pathname, course.linkId]);

  useEffect(() => {
    if (!rtcJoined || rtc.current) return;

    if (platform === 'web') {
      const webClient = roomStore.rtcClient as AgoraWebClient;
      const uid = +roomStore.state.me.uid as number;
      const streamSpec: AgoraStreamSpec = {
        streamID: uid,
        video: true,
        audio: true,
        mirror: false,
        screen: false,
        microphoneId: mediaDevice.microphoneId,
        cameraId: mediaDevice.cameraId,
        audioOutput: {
          volume: mediaDevice.speakerVolume,
          deviceId: mediaDevice.speakerId
        }
      }
      console.log("canPb>>> ", canPublish, roomStore.state.course.linkId, roomStore.state.me.uid);
      if (canPublish && !publishLock.current) {
        publishLock.current = true;
        webClient
          .publishLocalStream(streamSpec)
          .then(() => {
            console.log("[agora-web] publish local stream");
          }).catch(console.warn)
          .finally(() => {
            publishLock.current = false;
          })
      }
    }

    if (platform === 'electron' && rtcJoined) {
      const nativeClient = roomStore.rtcClient as AgoraElectronClient;
      if (canPublish && !publishLock.current) {
        publishLock.current = true;
        nativeClient.publish();
        publishLock.current = false;
      }
    }
  }, [
    rtcJoined,
    uid,
    role,
    mediaDevice,
    canPublish
  ]);

  useEffect(() => {
    if (!roomState.me.uid || !roomState.course.rid) return;
    if (classroom) {
      if (platform === 'web') {
        const webClient = roomStore.rtcClient as AgoraWebClient;
        if (webClient.joined || rtc.current) {
          return;
        }
        console.log("[agora-rtc] add event listener");
        webClient.rtc.on('onTokenPrivilegeWillExpire', (evt: any) => {
          // you need obtain the `newToken` token from server side 
          const newToken = '';
          webClient.rtc.renewToken(newToken);
          console.log('[agora-web] onTokenPrivilegeWillExpire', evt);
        });
        webClient.rtc.on('onTokenPrivilegeDidExpire', (evt: any) => {
          // you need obtain the `newToken` token from server side 
          const newToken = '';
          webClient.rtc.renewToken(newToken);
          console.log('[agora-web] onTokenPrivilegeDidExpire', evt);
        });
        webClient.rtc.on('error', (evt: any) => {
          console.log('[agora-web] error evt', evt);
        });
        webClient.rtc.on('stream-published', ({ stream }: any) => {
          const _stream = new AgoraStream(stream, stream.getId(), true);
          roomStore.addLocalStream(_stream);
        });
        webClient.rtc.on('stream-subscribed', ({ stream }: any) => {
          const streamID = stream.getId();
          // when streamID is not share_id use switch high or low stream in dual stream mode
          if (location.pathname.match(/live/) && streamID !== SHARE_ID) {
            if (roomStore.state.course.teacherId
              && roomStore.state.course.teacherId === `${streamID}`) {
              webClient.setRemoteVideoStreamType(stream, 0);
              console.log("[agora-web] dual stream set high for teacher");
            }
            else {
              webClient.setRemoteVideoStreamType(stream, 1);
              console.log("[agora-web] dual stream set low for student");
            }
          }
          const _stream = new AgoraStream(stream, stream.getId(), false);
          console.log("[agora-web] subscribe remote stream, id: ", stream.getId());
          roomStore.addRemoteStream(_stream);
        });
        webClient.rtc.on('stream-added', ({ stream }: any) => {
          console.log("[agora-web] added remote stream, id: ", stream.getId());
          webClient.subscribe(stream);
        });
        webClient.rtc.on('stream-removed', ({ stream }: any) => {
          console.log("[agora-web] removed remote stream, id: ", stream.getId(), roomStore.applyUid);
          const id = stream.getId();
          if (id === roomStore.applyUid) {
            globalStore.removeNotice();
            me.role === 'teacher' &&
            roomStore.updateCourseLinkUid(0).then(() => {
              console.log("update teacher link_uid to 0");
            }).catch(console.warn);
          }
          roomStore.removeRemoteStream(stream.getId());
        });
        webClient.rtc.on('peer-online', ({uid}: any) => {
          console.log("[agora-web] peer-online, id: ", uid);
          roomStore.addPeerUser(uid);
        });
        webClient.rtc.on('peer-leave', ({ uid }: any) => {
          console.log("[agora-web] peer-leave, id: ", uid, roomStore.applyUid);
          if (uid === roomStore.applyUid) {
            globalStore.removeNotice();
            me.role === 'teacher' &&
            roomStore.updateCourseLinkUid(0).then(() => {
              console.log("update teacher link_uid to 0");
            }).catch(console.warn);
          }
          roomStore.removePeerUser(uid);
          roomStore.removeRemoteStream(uid);
        });
        webClient.rtc.on("stream-fallback", ({ uid, attr }: any) => {
          const msg = attr === 0 ? 'resume to a&v mode' : 'fallback to audio mode';
          console.info(`[agora-web] stream: ${uid} fallback: ${msg}`);
        })
        rtc.current = true;
        // WARN: IF YOU ENABLED APP CERTIFICATE, PLEASE SIGN YOUR TOKEN IN YOUR SERVER SIDE AND OBTAIN IT FROM YOUR OWN TRUSTED SERVER API
        webClient
          .joinChannel({
            uid: +roomState.me.uid, 
            channel: roomState.course.rid,
            token: '',
            dual: false
          }).then(() => {
            
          }).catch(console.warn).finally(() => {
            rtc.current = false;
          });
        return () => {
          const events = [
            'onTokenPrivilegeWillExpire',
            'onTokenPrivilegeDidExpire',
            'error',
            'stream-published',
            'stream-subscribed',
            'stream-added',
            'stream-removed',
            'peer-online',
            'peer-leave',
            'stream-fallback'
          ]
          for (let eventName of events) {
            webClient.rtc.off(eventName, () => {});
          }
          console.log("[agora-web] remove event listener");
          !rtc.current && webClient.exit().then(() => {
            console.log("[agora-web] do remove event listener");
          }).catch(console.warn)
            .finally(() => {
              rtc.current = true;
              roomStore.removeLocalStream();
            });
        }
      }

      if (platform === 'electron') {
        const rtcClient = roomStore.rtcClient;
        const nativeClient = rtcClient as AgoraElectronClient;
        if (nativeClient.joined) {
          console.log("[agora-electron] electron joined ", nativeClient.joined);
          return;
        }
        nativeClient.on('executefailed', (...args: any[]) => {
          console.warn("[agora-electron] executefailed", ...args);
        });
        nativeClient.on('error', (evt: any) => {
          console.warn('[agora-electron] error evt', evt);
        });
        // when trigger `joinedchannel` it means publish rtc stream success
        nativeClient.on('joinedchannel', (evt: any) => {
          console.log("[agora-electron stream-published")
          const stream = evt.stream;
          const _stream = new AgoraStream(stream, stream.uid, true);
          roomStore.addLocalStream(_stream);
        });
        // when trigger `userjoined` it means peer user & peer stream is online
        nativeClient.on('userjoined', (evt: any) => {
          const stream = evt.stream;
          const _stream = new AgoraStream(stream, stream.uid, false);
          if (location.pathname.match(/live/) && stream.uid !== SHARE_ID) {
            if (roomStore.state.course.teacherId
              && roomStore.state.course.teacherId === `${stream.uid}`) {
              const res = nativeClient.rtcEngine.setRemoteVideoStreamType(stream, 0);
              console.log("[agora-electron] dual stream set high for teacher, ", res);
            }
            else {
              const res = nativeClient.rtcEngine.setRemoteVideoStreamType(stream, 1);
              console.log("[agora-electron] dual stream set low for student, ", res);
            }
          }
          roomStore.addPeerUser(stream.uid);
          roomStore.addRemoteStream(_stream);
        });
        // when trigger `removestream` it means peer user & peer stream is offline
        nativeClient.on('removestream', ({ uid }: any) => {
          if (uid === roomStore.applyUid) {
            globalStore.removeNotice();
            me.role === 'teacher' &&
            roomStore.updateCourseLinkUid(0).then(() => {
              console.log("update teacher link_uid to 0");
            }).catch(console.warn);
          }
          roomStore.removePeerUser(uid);
          roomStore.removeRemoteStream(uid);
        });
        // WARN: IF YOU ENABLED APP CERTIFICATE, PLEASE SIGN YOUR TOKEN IN YOUR SERVER SIDE AND OBTAIN IT FROM YOUR OWN TRUSTED SERVER API
        nativeClient.joinChannel({
          uid: +roomState.me.uid, 
          channel: roomState.course.rid,
          token: '',
          dual: isSmallClass
        });
        roomStore.setRTCJoined(true);
        return () => {
          const events = [
            'executefailed',
            'error',
            'joinedchannel',
            'userjoined',
            'removestream',
          ]
          for (let eventName of events) {
            nativeClient.off(eventName, () => {})
          }
          !rtc.current && nativeClient.exit();
          !rtc.current && roomStore.setRTCJoined(false);
          !rtc.current && roomStore.removeLocalStream();
        }
      }
    }
  }, [JSON.stringify([roomState.me.uid, roomState.course.rid])]);

  return (
    <div className={`classroom small-class`}>
      <NativeSharedWindow />
      {children}
      <Nav />
      <RoomDialog />
    </div>
  );
}

