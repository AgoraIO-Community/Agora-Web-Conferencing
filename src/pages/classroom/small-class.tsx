import React, { useReducer, createContext } from 'react';
import VideoMarquee from '../../components/video-marquee';
import VideoPlayer from '../../components/video-player'
import MediaBoard from '../../components/mediaboard';
import Roomboard from '../../components/roomboard';
import useStream from '../../hooks/use-streams';
import { roomStore } from '../../stores/room'
import './small-class.scss';

export default function SmallClass() {
  const { teacher, students } = useStream();
  const group = [teacher, ...students];
  const me = roomStore.state.me;

  console.log(group);

  let maxIndex = group.findIndex(x => x && me && String(x.streamID) !== me.uid);
  console.log(maxIndex);

  let student = (maxIndex !== -1) ? group[maxIndex] : {}
  let rest = group.filter(e => e!== student);
  console.log(student);

  return (
    <div className="room-container">

      <VideoMarquee excludes={rest} />

      <div className="container" style={{justifyContent:'flex-end'}}>

        {(maxIndex !== -1) ? <VideoPlayer
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
          fullView
        /> : <></>}
        {/* <MediaBoard /> */}

        <Roomboard currentActive={'media'} />

      </div>
    </div>
  )
}