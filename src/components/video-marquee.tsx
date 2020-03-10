import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';
import VideoPlayer from './video-player';
import './video-marquee.scss';
import useStream from '../hooks/use-streams';
import { AgoraMediaStream } from '../utils/types';

const showScrollbar = () => {
  const $marquee = document.querySelector(".video-marquee .agora-video-view");
  if ($marquee) {
    const clientWidth = $marquee.clientWidth;
    const marqueeLength: number = document.querySelectorAll(".video-marquee .agora-video-view").length;
    const videoMarqueeMark = document.querySelector('.video-marquee-mask')
    if (clientWidth && videoMarqueeMark) {
      const videoMarqueeWidth = videoMarqueeMark.clientWidth;
      const width: number = clientWidth * marqueeLength;
      // console.log("[video-marquee] videoMarqueeWidth: ", videoMarqueeWidth, ", width: ", width);
      if (videoMarqueeWidth <= width) {
        return true;
      }
    }
  }
  return false;
}

interface VideoMarqueeProps {
  excludes?: any
}

const VideoMarquee: React.FC<VideoMarqueeProps> = ({excludes}) => {

  const { teacher, students, onPlayerClick } = useStream();

  const marqueeEl = useRef(null);

  const scrollLeft = (current: any, offset: number) => {
    current.scrollLeft += (offset * current.childNodes[1].offsetWidth);
  }

  const handleScrollLeft = (evt: any) => {
    scrollLeft(marqueeEl.current, 1);
  }

  const handleScrollRight = (evt: any) => {
    scrollLeft(marqueeEl.current, -1);
  }

  const ref = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      ref.current = true;
    }
  }, []);

  const [scrollBar, setScrollBar] = useState<boolean>(false);

  useLayoutEffect(() => {
    if (!students.length) return;
    !ref.current && setScrollBar(showScrollbar());
  }, [students]);

  useEffect(() => {
    window.addEventListener('resize', (evt: any) => {
      !ref.current && setScrollBar(showScrollbar());
    });
    return () => {
      window.removeEventListener('resize', () => { });
    }
  }, []);

  console.log('exclude :', excludes);
  return (
    <div className="video-marquee-container" style={{
      position:"absolute",
      top:0,
      left:0,
      zIndex:10,
      backgroundColor:'transparent'
    }}>
      <div className="main">

      </div>
      <div className="video-marquee-mask">
        <div className="video-marquee" ref={marqueeEl}>
          {scrollBar ?
            <div className="scroll-btn-group">
              <div className="icon icon-left" onClick={handleScrollLeft}></div>
              <div className="icon icon-right" onClick={handleScrollRight}></div>
            </div> : null
          }
          {
            excludes.map((student: AgoraMediaStream) => (
              (student)?<VideoPlayer
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
              />:''
          ))
          }
        </div>
      </div>
    </div>
  )
}
export default React.memo(VideoMarquee);