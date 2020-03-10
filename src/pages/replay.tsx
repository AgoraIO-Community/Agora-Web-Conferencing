import React, { useEffect, useMemo, useRef, useCallback, useState } from 'react';
import './replay.scss';
import Slider from '@material-ui/core/Slider';
import { Subject } from 'rxjs';
import { Player, PlayerPhase } from 'white-web-sdk';
import { useParams, useLocation, Redirect } from 'react-router';
import moment from 'moment';
import { Progress } from '../components/progress/progress';
import { globalStore } from '../stores/global';
import { WhiteboardAPI, RTMRestful } from '../utils/api';
import { whiteboard } from '../stores/whiteboard';
import "video.js/dist/video-js.css";
import { getOSSUrl } from '../utils/helper';
import { t } from '../i18n';
import { RTMReplayer, RtmPlayerState } from '../components/whiteboard/agora/rtm-player';
import { errorStore } from './error-page/state';

export interface IPlayerState {
  beginTimestamp: number
  duration: number
  roomToken: string
  mediaURL: string
  isPlaying: boolean
  progress: number
  player: any

  currentTime: number
  phase: PlayerPhase
  isFirstScreenReady: boolean
  isPlayerSeeking: boolean
  seenMessagesLength: number
  isChatOpen: boolean
  isVisible: boolean
  replayFail: boolean
}

export const defaultState: IPlayerState = {
  beginTimestamp: 0,
  duration: 0,
  roomToken: '',
  mediaURL: '',
  isPlaying: false,
  progress: 0,
  player: null,

  currentTime: 0,
  phase: PlayerPhase.Pause,
  isFirstScreenReady: false,
  isPlayerSeeking: false,
  seenMessagesLength: 0,
  isChatOpen: false,
  isVisible: false,
  replayFail: false,
}

class ReplayStore {
  public subject: Subject<IPlayerState> | null;
  public state: IPlayerState | null;

  constructor() {
    this.subject = null;
    this.state = null;
  }

  initialize() {
    this.subject = new Subject<IPlayerState>();
    this.state = defaultState;
    this.subject.next(this.state);
  }

  subscribe(setState: any) {
    this.initialize();
    this.subject && this.subject.subscribe(setState);
  }

  unsubscribe() {
    this.subject && this.subject.unsubscribe();
    this.state = null;
    this.subject = null;
  }

  commit(state: IPlayerState) {
    this.subject && this.subject.next(state);
  }

  setPlayer(player: Player) {
    if (!this.state) return;
    this.state = {
      ...this.state,
      player
    }
    this.commit(this.state);
  }

  setCurrentTime(scheduleTime: number) {
    if (!this.state) return;
    this.state = {
      ...this.state,
      currentTime: scheduleTime
    }
    this.commit(this.state);
  }

  updatePlayerStatus(isPlaying: boolean) {
    if (!this.state) return;

    this.state = {
      ...this.state,
      isPlaying,
    }
    if (!this.state.isPlaying && this.state.player) {
      this.state.player.seekToScheduleTime(0);
    }
    this.commit(this.state);
  }

  updateProgress(progress: number) {
    if (!this.state) return
    this.state = {
      ...this.state,
      progress
    }
    this.commit(this.state);
  }

  setReplayFail(val: boolean) {
    if (!this.state) return
    this.state = {
      ...this.state,
      replayFail: val
    }
    this.commit(this.state);
  }

  updatePhase(phase: PlayerPhase) {
    if (!this.state) return
    let isPlaying = this.state.isPlaying;

    if (phase === PlayerPhase.Playing) {
      isPlaying = true;
    }

    if (phase === PlayerPhase.Ended || phase === PlayerPhase.Pause) {
      isPlaying = false;
    }

    this.state = {
      ...this.state,
      phase,
      isPlaying,
    }
    
    this.commit(this.state);
  }

  loadFirstFrame() {
    if (!this.state) return
    this.state = {
      ...this.state,
      isFirstScreenReady: true,
    }
    this.commit(this.state);
  }

  
  async joinRoom(_uuid: string) {
    return await WhiteboardAPI.joinRoom(_uuid);
  }
}

const store = new ReplayStore();

const ReplayContext = React.createContext({} as IPlayerState);

const useReplayContext = () => React.useContext(ReplayContext);

const ReplayContainer: React.FC<{}> = () => {
  const [state, setState] = React.useState<IPlayerState>(defaultState);

  const {uuid, startTime, endTime, mediaUrl} = useParams();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const rid: string = searchParams.get('rid') as string;
  const senderId: string = searchParams.get('senderId') as string;

  React.useEffect(() => {
    store.subscribe((state: any) => {
      setState(state);
    });
    return () => {
      store.unsubscribe();
    }
  }, []);

  if (!uuid || !rid || !startTime || !endTime || !mediaUrl) {
    errorStore.state = {
      reason: t('error.components.paramsEmpty', {reason: 'uuid, rid, startTime, endTime, mediaUrl'})
    }
    return <Redirect to="/404"></Redirect>
  }

  const value = state;

  return (
    <ReplayContext.Provider value={value}>
      <NetlessAgoraReplay
        rid={rid}
        senderId={senderId}
        whiteboardUUID={uuid}
        startTime={+startTime}
        endTime={+endTime}
        mediaUrl={mediaUrl}
      />
    </ReplayContext.Provider>
  )
}

export default ReplayContainer;

export type NetlessAgoraReplayProps = {
  whiteboardUUID: string
  rid: string
  senderId: string
  startTime: number
  endTime: number
  mediaUrl: string
}

export const NetlessAgoraReplay: React.FC<NetlessAgoraReplayProps> = ({
  whiteboardUUID: uuid,
  rid,
  senderId,
  startTime,
  endTime,
  mediaUrl
}) => {
  const state = useReplayContext();

  const player = useMemo(() => {
    if (!store.state || !store.state.player) return null;
    return store.state.player as Player;
  }, [store.state]);

  const handlePlayerClick = () => {
    if (!store.state || !player) return;

    if (player.phase === PlayerPhase.Playing) {
      player.pause();
      return;
    }
    if (player.phase === PlayerPhase.WaitingFirstFrame || player.phase === PlayerPhase.Pause) {
      player.play();
      return;
    }

    if (player.phase === PlayerPhase.Ended) {
      player.seekToScheduleTime(0);
      player.play();
      return;
    }
  }

  const handleChange = (event: any, newValue: any) => {
    store.setCurrentTime(newValue);
    store.updateProgress(newValue);
  }

  const onWindowResize = () => {
    if (state.player) {
      state.player.refreshViewSize();
    }
  }

  const handleSpaceKey = (evt: any) => {
    if (evt.code === 'Space') {
      if (state.player) {
        handleOperationClick(state.player);
      }
    }
  }

  const handleOperationClick = (player: Player) => {
    switch (player.phase) {
      case PlayerPhase.WaitingFirstFrame:
      case PlayerPhase.Pause: {
        player.play();
        break;
      }
      case PlayerPhase.Playing: {
        player.pause();
        break;
      }
      case PlayerPhase.Ended: {
        player.seekToScheduleTime(0);
        break;
      }
    }
  }

  const duration = useMemo(() => {
    if (!startTime || !endTime) return 0;
    const _duration = Math.abs(+startTime - +endTime);
    return _duration;
  }, [startTime, endTime]);

  const lock = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      lock.current = true;
    }
  }, []);

  useEffect(() => {
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', handleSpaceKey);
    if (uuid && startTime && endTime) {
        store.joinRoom(uuid).then(({roomToken}) => {
          WhiteboardAPI.replayRoom(whiteboard.client,
          {
            beginTimestamp: +startTime,
            duration: duration,
            room: uuid,
            mediaURL: getOSSUrl(mediaUrl as string),
            roomToken: roomToken,
          }, {
            onCatchErrorWhenRender: error => {
              error && console.warn(error);
              globalStore.showToast({
                message: t('toast.replay_failed'),
                type: 'notice'
              });
            },
            onCatchErrorWhenAppendFrame: error => {
              error && console.warn(error);
              globalStore.showToast({
                message: t('toast.replay_failed'),
                type: 'notice'
              });
            },
            onPhaseChanged: phase => {
              store.updatePhase(phase);
            },
            onLoadFirstFrame: () => {
              store.loadFirstFrame();
            },
            onSliceChanged: () => {
            },
            onPlayerStateChanged: (error) => {
            },
            onStoppedWithError: (error) => {
              error && console.warn(error);
              globalStore.showToast({
                message: t('toast.replay_failed'),
                type: 'notice'
              });
              store.setReplayFail(true);
            },
            onScheduleTimeChanged: (scheduleTime) => {
              if (lock.current) return;
              store.setCurrentTime(scheduleTime);
            }
          }).then((player: Player | undefined) => {
            if (player) {
              store.setPlayer(player);
              player.bindHtmlElement(document.getElementById("whiteboard") as HTMLDivElement);
            }
          })
        });
    }
    return () => {
      window.removeEventListener('resize', onWindowResize);
      window.removeEventListener('keydown', onWindowResize);
    }
  }, []);

  const totalTime = useMemo(() => {
    return moment(duration).format("mm:ss");
  }, [duration]);

  const time = useMemo(() => {
    return moment(state.currentTime).format("mm:ss");
  }, [state.currentTime]);

  const PlayerCover = useCallback(() => {
    if (!player) {
      return (<Progress title={t("replay.loading")} />)
    }

    if (player.phase === PlayerPhase.Playing) return null;

    return (
      <div className="player-cover">
        {player.phase === PlayerPhase.Buffering ? <Progress title={t("replay.loading")} />: null}
        {player.phase === PlayerPhase.Pause || player.phase === PlayerPhase.Ended || player.phase === PlayerPhase.WaitingFirstFrame ? 
          <div className="play-btn" onClick={handlePlayerClick}></div> : null}
      </div>
    )
  }, [player, state]);

  return (
    <div className="replay">
      <div className={`player-container`} >
        <PlayerCover />
        <div className="player">
          <div className="agora-logo"></div>
          <div id="whiteboard" className="whiteboard"></div>
          <div className="video-menu">
            <div className="control-btn">
              <div className={`btn ${player && player.phase === PlayerPhase.Playing ? 'paused' : 'play'}`} onClick={handlePlayerClick}></div>
            </div>
            <div className="progress">
              <Slider
                className='custom-video-progress'
                value={state.currentTime}
                onMouseDown={() => {
                  if (store.state && store.state.player) {
                    const player = store.state.player as Player;
                    player.pause();
                    lock.current = true;
                  }
                }}
                onMouseUp={() => {
                  if (store.state && store.state.player) {
                    const player = store.state.player as Player;
                    player.seekToScheduleTime(state.currentTime);
                    player.play();
                    lock.current = false;
                  }
                }}
                onChange={handleChange}
                min={0}
                max={duration}
                aria-labelledby="continuous-slider"
              />
              <div className="time">
                <div className="current_duration">{time}</div>
                  /
                <div className="video_duration">{totalTime}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="video-container">
        <div className="video-player">
          <video id="white-sdk-video-js" className="video-js video-layout" style={{width: "100%", height: "100%", objectFit: "cover"}}></video>
        </div>
        <div className="chat-holder chat-board chat-messages-container">
          {/* <RTMReplayer
            senderId={senderId}
            rid={rid}
            startTime={startTime}
            endTime={endTime}
            currentSeekTime={state.currentTime}
            onPhaseChanged={(e: RtmPlayerState) => {
              if (e !== RtmPlayerState.load) {
                player?.stop();
              }
            }}
          ></RTMReplayer> */}
        </div>
      </div>
    </div>
  )
}