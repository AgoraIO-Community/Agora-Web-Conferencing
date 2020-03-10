import React, {useRef, useEffect} from 'react';
import VideoPlayer from '../../components/video-player';

import './big-class.scss';
import ChatBoard from '../../components/chat/board';
import MediaBoard from '../../components/mediaboard';
import useStream from '../../hooks/use-streams';
import useChatText from '../../hooks/use-chat-text';
import { RoomMessage } from '../../utils/agora-rtm-client';
import { AgoraElectronClient } from '../../utils/agora-electron-client';
import AgoraWebClient from '../../utils/agora-rtc-client';
import { useRoomState } from '../../containers/root-container';
import { roomStore } from '../../stores/room';
import { platform } from '../../utils/platform';

export default function BigClass() {
  const {
    value,
    messages,
    sendMessage,
    handleChange,
    role,
    roomName
  } = useChatText();

  const roomState = useRoomState();

  const me = roomState.me;

  const memberCount = roomState.rtm.memberCount;

  const {teacher, currentHost, onPlayerClick} = useStream();

  const rtmLock = useRef<boolean>(false);
  const lock = useRef<boolean>(false);
  
  useEffect(() => {
    rtmLock.current = false;
    return () => {
      rtmLock.current = true;
      lock.current = true;
    }
  }, []);

  const handleClick = (type: string) => {
    if (rtmLock.current) return;

    if (type === 'hands_up') {
      if (roomStore.state.course.teacherId) {
        rtmLock.current = true;
        roomStore.rtmClient.sendPeerMessage(roomStore.state.course.teacherId,
          {cmd: RoomMessage.applyCoVideo})
          .then((result: any) => {
            console.log("peerMessage result ", result);
          })
          .catch(console.warn)
          .finally(() => {
            rtmLock.current = false;
          })
      }
    }
  
    if (type === 'hands_up_end') {
      if (roomStore.state.course.teacherId) {
        rtmLock.current = true;
        roomStore.rtmClient.sendPeerMessage(roomStore.state.course.teacherId,
          {cmd: RoomMessage.cancelCoVideo})
          .then((result: any) => {
            console.log("peerMessage result ", result);
          })
          .catch(console.warn)
          .finally(() => {
            rtmLock.current = false;
          })
      }
    }
  }

  // TODO: handleClose
  const closeLock = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      closeLock.current = true;
    }
  }, []);

  const handleClose = (type: string, streamID: number) => {
    if (type === 'close') {
      if (!currentHost || closeLock.current) return;

      const rtmClient = roomStore.rtmClient;
      const rtcClient = roomStore.rtcClient;
      const teacherUid = roomStore.state.course.teacherId;

      console.log("close rtmClient: ", rtmClient, ", rtcClient: ", rtcClient, ", teacherUid: ", teacherUid, ", lock :", closeLock.current);

      if (currentHost.streamID === +me.uid && teacherUid) {
        const quitClient = new Promise((resolve, reject) => {
          if (platform === 'electron') {
            const nativeClient = rtcClient as AgoraElectronClient;
            const val = nativeClient.unpublish();
            if (val >= 0) {
              resolve();
            } else {
              console.warn('quit native client failed');
              reject(val);
            }
          }
          if (platform === 'web') {
            const webClient = rtcClient as AgoraWebClient;
            resolve(webClient.unpublishLocalStream());
          }
        });
        closeLock.current = true;
        rtmLock.current = true;
        Promise.all([
          rtmClient.sendPeerMessage(`${teacherUid}`,{
            cmd: RoomMessage.cancelCoVideo
          }),
          quitClient
        ]).then(() => {
          rtmLock.current = false;
        }).catch((err: any) => {
          rtmLock.current = false;
          console.warn(err);
          throw err;
        }).finally(() => {
          closeLock.current = false;
        })
      }

      if (teacherUid && teacherUid === me.uid) {
        rtmLock.current = true;
        closeLock.current = true;
        Promise.all([
          rtmClient.sendPeerMessage(`${streamID}`, {
            cmd: RoomMessage.cancelCoVideo,
          }),
          roomStore.updateCourseLinkUid(0)
        ]).then(() => {
          rtmLock.current = false;
        }).catch((err: any) => {
          rtmLock.current = false;
          console.warn(err);
        }).finally(() => {
          closeLock.current = false;
        })
      }
    }
  }

  return (
    <div className="room-container">
      <div className="live-container">
        <MediaBoard
          handleClick={handleClick}
        >
          <div className="video-container">
          {currentHost ? 
            <VideoPlayer
              role="teacher"
              streamID={currentHost.streamID}
              stream={currentHost.stream}
              domId={`${currentHost.streamID}`}
              id={`${currentHost.streamID}`}
              account={currentHost.account}
              handleClick={onPlayerClick}
              close={me.role === 'teacher' || +me.uid === currentHost.streamID}
              handleClose={handleClose}
              video={currentHost.video}
              audio={currentHost.audio}
              local={currentHost.local}
            /> :
            null
          }
        </div>
        </MediaBoard>
      </div>
      <div className="live-board">
        <div className="video-board">
          {teacher ?
            <VideoPlayer
              role="teacher"
              streamID={teacher.streamID}
              stream={teacher.stream}
              domId={`dom-${teacher.streamID}`}
              id={`${teacher.streamID}`}
              account={teacher.account}
              handleClick={onPlayerClick}
              audio={Boolean(teacher.audio)}
              video={Boolean(teacher.video)}
              local={Boolean(teacher.local)}
              /> :
            <VideoPlayer
              role="teacher"
              account={'teacher'}
              streamID={0}
              video={true}
              audio={true}
              />}
        </div>
        <ChatBoard
          name={roomName}
          teacher={role === 'teacher'}
          messages={messages}
          mute={Boolean(roomState.course.muteChat)}
          value={value}
          roomCount={memberCount}
          sendMessage={sendMessage}
          handleChange={handleChange} />
      </div>
    </div>
  )
}