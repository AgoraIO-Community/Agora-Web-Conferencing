import React, {useReducer, createContext} from 'react';
import VideoMarquee from '../../components/video-marquee';
import VideoPlayer from '../../components/video-player'
import MediaBoard from '../../components/mediaboard';
import Roomboard from '../../components/roomboard';
import useStream from '../../hooks/use-streams';
import {roomStore} from '../../stores/room'
import { useRoomState} from '../../containers/root-container';

import './small-class.scss';

export default function SmallClass() {
    let student: any = {};
    let maxIndex: number = -1;
    const {teacher, students, onPlayerClick, sharedStream} = useStream();
    const group = [teacher, ...students];
    let rest: any[];
    let roomState = useRoomState();

    let sharing = Boolean(sharedStream) || Boolean(roomState.rtc.shared);
    console.log("sharing: ", sharing, sharedStream);

    if (Boolean(sharing)) {
        rest = group;
    } else {
        const me = roomStore.state.me;
        console.log(group);
        maxIndex = group.findIndex(x => x && me && String(x.streamID) !== me.uid);
        console.log(maxIndex);

        student = (maxIndex !== -1) ? group[maxIndex] : {};
        rest = group.filter(e => e !== student);
        console.log(student);
    }

    return (
        <div className="room-container">

            <VideoMarquee excludes={rest}/>

            <div className="container" style={{justifyContent: 'flex-end'}}>
                {
                     sharing? <MediaBoard /> : <></>
                }
                {(maxIndex !== -1 && !sharedStream) ? <VideoPlayer
                    role="student"
                    domId={`dom-${student.streamID}`}
                    key={`${student.streamID}`}
                    id={`${student.streamID}`}
                    account={student.account}
                    streamID={student.streamID}
                    stream={student.stream}
                    video={student.video}
                    audio={student.audio}
                    local={student.local}
                    handleClick={onPlayerClick}
                    fullView
                /> : <></>}

                <Roomboard currentActive={'media'}/>

            </div>
        </div>
    )
}