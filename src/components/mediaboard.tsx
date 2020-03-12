import React, {useMemo, useEffect, useState, useRef, useCallback} from 'react';
import Whiteboard from './whiteboard';
import VideoPlayer from '../components/video-player';
import Control from './whiteboard/control';
import {AgoraStream} from '../utils/types';
import useStream from '../hooks/use-streams';
import {useLocation} from 'react-router';
import Tools from './whiteboard/tools';
import {SketchPicker, RGBColor} from 'react-color';
import {AgoraElectronClient} from '../utils/agora-electron-client';
import {UploadBtn} from './whiteboard/upload/upload-btn';
import {ResourcesMenu} from './whiteboard/resources-menu';
import ScaleController from './whiteboard/scale-controller';
import {PPTProgressPhase} from '../utils/upload-manager';
import {UploadNoticeView} from '../components/whiteboard/upload/upload-notice';
import Progress from '../components/progress/progress';
import {useRoomState, useWhiteboardState, useGlobalState} from '../containers/root-container';
import {roomStore} from '../stores/room';
import {whiteboard} from '../stores/whiteboard';
import {globalStore} from '../stores/global';
import {platform} from '../utils/platform';
import AgoraWebClient, {SHARE_ID} from '../utils/agora-rtc-client';
import "white-web-sdk/style/index.css";
import {ViewMode} from 'white-web-sdk';
import {t} from '../i18n';

const pathName = (path: string): string => {
    const reg = /\/([^/]*)\//g;
    reg.exec(path);
    if (RegExp.$1 === "aria") {
        return "";
    } else {
        return RegExp.$1;
    }
}

interface MediaBoardProps {
    handleClick?: (type: string) => void
    children?: any
}

const MediaBoard: React.FC<MediaBoardProps> = ({
                                                   handleClick,
                                                   children
                                               }) => {

    const roomState = useRoomState();

    const whiteboardState = useWhiteboardState();

    const role = roomState.me.role;
    const room = whiteboardState.room;
    const me = roomState.me;
    const course = roomState.course;
    const rtmState = roomState.rtm;

    const ref = useRef<any>(false);

    const [pageTool, setPageTool] = useState<string>('');

    const {sharedStream} = useStream();

    const shared = roomState.rtc.shared;

    useEffect(() => {
        if (!shared && platform === 'web') return;

        const rtcClient = roomStore.rtcClient;
        if (!shared) {
            if (platform === 'electron') {
                const nativeClient = rtcClient as AgoraElectronClient;
                console.log("[native] electron screen sharing shared: ", shared, " nativeClient.shared: ", nativeClient.shared);
                nativeClient.shared &&
                nativeClient.stopScreenShare().then(() => {
                    console.log("[native] remove local shared stream");
                }).catch(console.warn);
                return;
            }
        }

        if (platform === 'web') {
            const webClient = rtcClient as AgoraWebClient;
            // WARN: IF YOU ENABLED APP CERTIFICATE, PLEASE SIGN YOUR TOKEN IN YOUR SERVER SIDE AND OBTAIN IT FROM YOUR OWN TRUSTED SERVER API
            const screenShareToken = '';
            webClient.startScreenShare(screenShareToken).then(() => {
                webClient.shareClient.on('onTokenPrivilegeWillExpire', (evt: any) => {
                    // WARN: IF YOU ENABLED APP CERTIFICATE, PLEASE SIGN YOUR TOKEN IN YOUR SERVER SIDE AND OBTAIN IT FROM YOUR OWN TRUSTED SERVER API
                    const newToken = '';
                    webClient.shareClient.renewToken(newToken);
                });
                webClient.shareClient.on('onTokenPrivilegeDidExpire', (evt: any) => {
                    // WARN: IF YOU ENABLED APP CERTIFICATE, PLEASE SIGN YOUR TOKEN IN YOUR SERVER SIDE AND OBTAIN IT FROM YOUR OWN TRUSTED SERVER API
                    const newToken = '';
                    webClient.shareClient.renewToken(newToken);
                });
                webClient.shareClient.on('stopScreenSharing', (evt: any) => {
                    console.log('stop screen share', evt);
                    webClient.stopScreenShare().then(() => {
                        globalStore.showToast({
                            message: t('toast.canceled_screen_share'),
                            type: 'notice'
                        });
                        roomStore.setScreenShare(false);
                    }).catch(console.warn).finally(() => {
                        console.log('[agora-web] stop share');
                    })
                })
                const localShareStream = webClient.shareClient._localStream
                const _stream = new AgoraStream(localShareStream, localShareStream.getId(), true);
                roomStore.addLocalSharedStream(_stream);
            }).catch((err: any) => {
                roomStore.setScreenShare(false);
                if (err.type === 'error' && err.msg === 'NotAllowedError') {
                    globalStore.showToast({
                        message: t('toast.canceled_screen_share'),
                        type: 'notice'
                    });
                }
                if (err.type === 'error' && err.msg === 'PERMISSION_DENIED') {
                    globalStore.showToast({
                        message: t('toast.screen_sharing_failed', {reason: err.msg}),
                        type: 'notice'
                    });
                }
                console.warn(err);
            }).finally(() => {
                console.log('[agora-web] start share');
            })
            return () => {
                console.log("before shared change", shared);
                shared && webClient.stopScreenShare().then(() => {
                    roomStore.setScreenShare(false);
                }).catch(console.warn).finally(() => {
                    console.log('[agora-web] stop share');
                })
            }
        }
    }, [shared]);

    const handlePageTool: any = (evt: any, type: string) => {
        setPageTool(type);
        console.log("[page-tool] click ", type);
        if (type === 'first_page') {
            changePage(1, true);
        }

        if (type === 'last_page') {
            changePage(totalPage, true);
        }

        if (type === 'prev_page') {
            changePage(currentPage - 1);
        }

        if (type === 'next_page') {
            changePage(currentPage + 1);
        }

        if (type === 'screen_sharing') {
            roomStore.setScreenShare(true);

            if (platform === 'electron') {
                const rtcClient = roomStore.rtcClient;
                globalStore.setNativeWindowInfo({
                    visible: true,
                    items: (rtcClient as AgoraElectronClient).getScreenShareWindows()
                })
            }
        }

        if (type === 'quit_screen_sharing') {
            roomStore.setScreenShare(false);
        }

        if (type === 'peer_hands_up') {
            globalStore.showDialog({
                type: 'apply',
                message: `${globalStore.state.notice.text}`,
            })
            setPageTool('');
        }

        if (handleClick) {
            handleClick(type);
        }
    }

    const isHost = useMemo(() => {
        return +roomStore.state.me.uid === +roomStore.state.course.linkId;
    }, [roomStore.state.me.uid,
        roomStore.state.course.linkId]);

    const location = useLocation();

    const current = useMemo(() => {
        return whiteboardState.scenes.get(whiteboardState.currentScenePath);
    }, [whiteboardState.scenes, whiteboardState.currentScenePath]);

    const totalPage = useMemo(() => {
        if (!current) return 0;
        return current.totalPage;
    }, [current]);

    const currentPage = useMemo(() => {
        if (!current) return 0;
        return current.currentPage + 1;
    }, [current]);

    const addNewPage: any = (evt: any) => {
        if (!current || !room) return;
        // const newIndex = netlessClient.state.sceneState.scenes.length;
        const newIndex = room.state.sceneState.index + 1;
        const scenePath = room.state.sceneState.scenePath;
        const currentPath = `/${pathName(scenePath)}`;
        room.putScenes(currentPath, [{}], newIndex);
        room.setSceneIndex(newIndex);
        whiteboard.updateRoomState();
    }

    const changePage = (idx: number, force?: boolean) => {
        if (ref.current || !current || !room) return;
        const _idx = idx - 1;
        if (_idx < 0 || _idx >= current.totalPage) return;
        if (force) {
            room.setSceneIndex(_idx);
            whiteboard.updateRoomState();
            return
        }
        if (current.type === 'dynamic') {
            if (_idx > current.currentPage) {
                room.pptNextStep();
                console.log("room.pptNextStep");
            } else {
                room.pptPreviousStep();
                console.log("room.pptPreviousStep");
            }
        } else {
            room.setSceneIndex(_idx);
            console.log("room.setSceneIndex", _idx);
        }
        whiteboard.updateRoomState();
    }

    const showControl: boolean = useMemo(() => {
        if (me.role === 'teacher') return true;
        if (location.pathname.match(/big-class/)) {
            if (me.role === 'student') {
                return true;
            }
        }
        return false;
    }, []);

    const items = [
        {
            name: 'selector'
        },
        {
            name: 'pencil'
        },
        {
            name: 'rectangle',
        },
        {
            name: 'ellipse'
        },
        {
            name: 'text'
        },
        {
            name: 'eraser'
        },
        {
            name: 'color_picker'
        },
        {
            name: 'add'
        },
        {
            name: 'upload'
        },
        {
            name: 'hand_tool'
        }
    ];

    const toolItems = useMemo(() => {
        return items.filter((item: any) => {
            if (role === 'teacher') return item;
            if (['add', 'folder', 'upload'].indexOf(item.name) === -1) {
                if (item.name === 'hand_tool') {
                    if (course.lockBoard) {
                        return false;
                    } else {
                        return true;
                    }
                }
                return item;
            }
        });
    }, [course.lockBoard]);

    const drawable: string = useMemo(() => {
        if (location.pathname.match('small-class|big-class')) {
            if (me.role === 'teacher') {
                return 'drawable';
            }
            if (me.role === 'student') {
                console.log("agora pathname: >>>>>>> ", location.pathname, me.grantBoard, me.role, Boolean(me.grantBoard));
                if (Boolean(me.grantBoard)) {
                    return 'drawable';
                } else {
                    return 'panel';
                }
            }
        }
        return 'drawable';
    }, [me.role, me.grantBoard, location]);

    const [tool, setTool] = useState<string | any>(drawable === 'drawable' ? 'pencil' : '');

    const [selector, updateSelector] = useState<string>('');

    const handleToolClick = (evt: any, name: string) => {
        if (!room) return;
        if (['upload', 'color_picker', 'hand_tool'].indexOf(name) !== -1 && name === tool) {
            setTool('');
            if (name === 'hand_tool') {
                room.handToolActive = false;
                updateSelector('');
            }
            return;
        }
        if (name !== 'hand_tool') {
            room.handToolActive = false;
            updateSelector('');
        }
        setTool(name);
        if (name === 'upload'
            || name === 'folder'
            || name === 'color_picker'
            || name === 'add'
            || name === 'hand_tool'
        ) {
            if (name === 'hand_tool') {

                room.handToolActive = true;
                updateSelector('hand');
                room.setMemberState({currentApplianceName: 'selector'});
            } else {
                if (name === 'add' && addNewPage) {
                    addNewPage();
                }
            }
            return;
        }
        room.setMemberState({currentApplianceName: name});
    }

    const onColorChanged = (color: any) => {
        if (!room) return;
        const {rgb} = color;
        const {r, g, b} = rgb;
        room.setMemberState({
            strokeColor: [r, g, b]
        });
    }

    const lock = useRef<boolean>(false);

    useEffect(() => {
        return () => {
            lock.current = true;
            whiteboard.destroy()
                .then(() => {
                    console.log("destroy whiteboard");
                }).catch(console.warn);
        }
    }, []);

    useEffect(() => {
        if (!rtmState.joined) return;
        if (!lock.current && !whiteboard.state.room) {
            lock.current = true;
            whiteboard.join({
                rid: roomStore.state.course.rid,
                uid: me.boardId,
                location: location.pathname,
                userPayload: {
                    userId: roomStore.state.me.uid,
                    identity: roomStore.state.me.role === 'teacher' ? 'host' : 'guest'
                }
            })
                .then(() => {
                    console.log("join whiteboard success");
                }).catch(console.warn)
                .finally(() => {
                    lock.current = false;
                })
        }

        if (!lock.current && course.boardId && me.boardId !== course.boardId && whiteboard.state.room) {
            lock.current = true;
            whiteboard.join({
                rid: roomStore.state.course.rid,
                uid: course.boardId,
                location: location.pathname,
                userPayload: {
                    userId: roomStore.state.me.uid,
                    identity: roomStore.state.me.role === 'teacher' ? 'host' : 'guest'
                }
            })
                .then(() => {
                    console.log("rejoin whiteboard success");
                }).catch(console.warn)
                .finally(() => {
                    lock.current = false;
                })
        }

    }, [rtmState.joined, me.boardId, course.boardId]);

    const [uploadPhase, updateUploadPhase] = useState<string>('');
    const [convertPhase, updateConvertPhase] = useState<string>('');

    useEffect(() => {
        console.log("[mediaboard] uploadPhase: ", uploadPhase, " convertPhase: ", convertPhase);
    }, [uploadPhase, convertPhase]);

    const UploadPanel = useCallback(() => {
        if (tool !== 'upload' || !room) return null;
        return (<UploadBtn
            room={room}
            uuid={room.uuid}
            roomToken={room.roomToken}
            onProgress={(phase: PPTProgressPhase, percent: number) => {
                console.log("[onProgress] phase: ", phase, " percent: ", percent);
                if (phase === PPTProgressPhase.Uploading) {
                    if (percent < 1) {
                        !uploadPhase && updateUploadPhase('uploading');
                    } else {
                        updateUploadPhase('upload_success');
                    }
                    return;
                }

                if (phase === PPTProgressPhase.Converting) {
                    if (percent < 1) {
                        !convertPhase && updateConvertPhase('converting');
                    } else {
                        updateConvertPhase('convert_success');
                    }
                    return;
                }
            }}
            onSuccess={() => {
                console.log("on success");
            }}
            onFailure={(err: any) => {
                // WARN: capture exception
                if (uploadPhase === 'uploading') {
                    updateUploadPhase('upload_failure');
                    return;
                }
                if (convertPhase === 'converting') {
                    updateConvertPhase('convert_failure');
                    return;
                }
            }}
        />)
    }, [tool, room]);

    useEffect(() => {
        if (uploadPhase === 'upload_success') {
            globalStore.showUploadNotice({
                title: t('room.upload_success'),
                type: 'ok',
            });
        }
        if (uploadPhase === 'convert_failure') {
            globalStore.showUploadNotice({
                title: t('room.upload_failure'),
                type: 'error',
            });
        }
    }, [uploadPhase]);

    useEffect(() => {
        if (convertPhase === 'convert_success') {
            globalStore.showUploadNotice({
                title: t('room.convert_success'),
                type: 'ok',
            });
        }
        if (convertPhase === 'convert_failure') {
            globalStore.showUploadNotice({
                title: t('room.convert_failure'),
                type: 'error',
            });
        }
    }, [convertPhase]);

    useEffect(() => {
        if (!me.role || !room) return;
        if (me.role === 'teacher') {
            if (roomStore.state.course.lockBoard) {
                room.setViewMode(ViewMode.Broadcaster);
            } else {
                room.setViewMode(ViewMode.Freedom);
            }
        }
        if (me.role === 'student') {
            if (roomStore.state.course.lockBoard) {
                room.handToolActive = false;
                room.disableCameraTransform = true;
                room.disableDeviceInputs = true;
            } else {
                room.disableCameraTransform = false;
                room.disableDeviceInputs = false;
            }
        }
    }, [room, roomStore.state.course.lockBoard, roomStore.state.me.role]);

    const globalState = useGlobalState();

    const scale = whiteboardState.scale ? whiteboardState.scale : 1;

    const UploadProgressView = useCallback(() => {
        if (uploadPhase === 'uploading') {
            return (
                <Progress title={t("room.uploading")}/>
            )
        } else if (convertPhase === 'converting') {
            return (
                <Progress title={t("room.converting")}/>
            )
        }
        return null;
    }, [uploadPhase, convertPhase]);

    let strokeColor: RGBColor | undefined = undefined;

    if (whiteboardState.room && whiteboardState.room.state.memberState.strokeColor) {
        const color = whiteboardState.room.state.memberState.strokeColor;
        strokeColor = {
            r: color[0],
            g: color[1],
            b: color[2],
        }
    }

    useEffect(() => {
        if (!room) return;
        if (drawable === 'panel') {
            room.disableDeviceInputs = true;
            room.disableCameraTransform = true;
            return;
        }
        room.disableDeviceInputs = false;
        room.disableCameraTransform = false;
    }, [drawable, room]);

    const showTools = drawable === 'drawable';

    // TODO: Edit this to add whiteboard

    return (
        <div className={`media-board ${drawable}`}>
            {sharedStream ?
                <VideoPlayer
                    id={`${sharedStream.streamID}`}
                    domId={`shared-${sharedStream.streamID}`}
                    className={'screen-sharing'}
                    streamID={sharedStream.streamID}
                    stream={sharedStream.stream}
                    video={true}
                    audio={true}
                    local={sharedStream.local}
                />
                :
                <div style={{display: "none"}}>
                    <Whiteboard
                        loading={whiteboardState.loading}
                        className={selector}
                        room={room}
                    />
                </div>
            }

            {/*<div className="layer">*/}
            {/*  {!sharedStream ? */}
            {/*  <>*/}
            {/*    {showTools ? <Tools*/}
            {/*    items={toolItems}*/}
            {/*    currentTool={tool}*/}
            {/*    handleToolClick={handleToolClick} /> : null}*/}
            {/*    {tool === 'color_picker' && strokeColor ?*/}
            {/*      <SketchPicker*/}
            {/*        color={strokeColor}*/}
            {/*        onChangeComplete={onColorChanged} />*/}
            {/*    : null}*/}
            {/*  </> : null}*/}
            {/*  <UploadPanel />*/}
            {/*  {children ? children : null}*/}
            {/*</div>*/}
            {/*{me.role === 'teacher' && room ?*/}
            {/*  <ScaleController*/}
            {/*    zoomScale={scale}*/}
            {/*    onClick={() => {*/}
            {/*      setTool('folder');*/}
            {/*    }}*/}
            {/*    onClickBoardLock={() => {*/}
            {/*      whiteboard.lock()*/}
            {/*        .then(console.log)*/}
            {/*        .catch(console.warn);*/}
            {/*    }}*/}
            {/*    zoomChange={(scale: number) => {*/}
            {/*      room.moveCamera({scale});*/}
            {/*      whiteboard.updateScale(scale);*/}
            {/*    }}*/}
            {/*  />*/}
            {/*  :*/}
            {/*  null*/}
            {/*}*/}
            {sharedStream && sharedStream.local ?
                <Control
                    notice={globalState.notice}
                    role={role}
                    sharing={Boolean(sharedStream)}
                    current={pageTool}
                    currentPage={currentPage}
                    totalPage={totalPage}
                    isHost={isHost}
                    onClick={handlePageTool}/> : null
            }
            {/*{tool === 'folder' && whiteboardState.room ? */}
            {/*  <ResourcesMenu*/}
            {/*    active={whiteboardState.activeDir}*/}
            {/*    items={whiteboardState.dirs}*/}
            {/*    onClick={(rootPath: string) => {*/}
            {/*      if (room) {*/}
            {/*        room.setScenePath(rootPath);*/}
            {/*        room.setSceneIndex(0);*/}
            {/*        whiteboard.updateRoomState();*/}
            {/*      }*/}
            {/*    }}*/}
            {/*    onClose={(evt: any) => {*/}
            {/*      setTool('')*/}
            {/*    }}*/}
            {/*  />*/}
            {/*: null}*/}
            {/*<UploadNoticeView />*/}
            {/*<UploadProgressView />*/}
        </div>
    )
}

export default React.memo(MediaBoard);