import React, { Children } from 'react';
import './index.scss';
import { Link } from 'react-router-dom';
import { useRoomState } from '../../containers/root-container';
interface MessageProps {
  nickname: string
  content: string
  link?: string
  sender?: boolean
  children?: any
  ref?: any
  className?: string
}

export const Message: React.FC<MessageProps> = ({
  nickname,
  content,
  link,
  sender,
  children,
  ref,
  className
}) => {

  const roomState = useRoomState();

  const text = React.useMemo(() => {
    if (link && roomState.course.rid) {
      return (
        <Link to={`${link}?rid=${roomState.course.rid}&senderId=${roomState.me.uid}`} target="_blank">course recording</Link>
      )
    }
    return link ? link : content;
  }, [content, link, roomState.course.rid])

  return (
  <div ref={ref} className={`message ${sender ? 'sent': 'receive'} ${className ? className : ''}`}>
    <div className="nickname">
      {nickname}
    </div>
    <div className="content">
      {text}
    </div>
    {children ? children : null}
  </div>
  )
}