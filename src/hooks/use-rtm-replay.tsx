import { Loading } from '../components/loading';
import {useEffect, useState, useRef, useCallback, Fragment, useMemo} from 'react';
import {useAsync} from 'react-use';
import { RTMRestful, QueryChannelMessage, AgoraChannelMessage } from '../utils/api/rtm-restful';
import moment from 'moment';
import React from 'react';
import { Message } from '../components/chat/message';

export interface RtmReplayResult {
  loading: boolean
  list?: RtmReplayList 
}

export type RtmReplayList = AgoraChannelMessage[] | undefined;

export enum RtmPlayerState {
  pending = 'pending',
  loading = 'loading',
  load = 'load',
};

export type RtmReplayProps = {
  rid: string,
  startTime?: string,
  endTime?: string,
  currentSeekTime: number,
  onPhaseChanged?: (e: RtmPlayerState) => void,
};

const RtmPlayer = ({currentSeekTime, ...props}: RtmReplayProps) => {

  const ref = useRef<any>(null);

  const [state, setState] = useState<RtmPlayerState>(RtmPlayerState.pending);

  useEffect(() => {
    props.onPhaseChanged && props.onPhaseChanged(state);
  }, [state]);

  const {value, loading} = useAsync<AgoraChannelMessage[] | undefined>(async (): Promise<AgoraChannelMessage[] | undefined> => {
    if (!props.rid || !props.startTime || !props.endTime) {
      throw new Error(`startTime & endTime & rid shouldn't be blank`);
    }
    const rtmRecord = new RTMRestful(process.env.REACT_APP_AGORA_CUSTOMER_ID as string, process.env.REACT_APP_AGORA_CUSTOMER_CERTIFICATE as string);
    const params = {
      rid: props.rid,
      startTime: moment(+props.startTime).utc().format('YYYY-MM-DDTHH:mm:ss'),
      endTime: moment(+props.endTime).utc().format('YYYY-MM-DDTHH:mm:ss'),
    }
    return await rtmRecord.getAllChannelMessages(params)
  }, [JSON.stringify(props)]);

  useEffect(() => {
    if (!loading) {
      setState(RtmPlayerState.load);
    }
  }, [loading]);

  const serializeMessage = (item: any) => {
    const {account, content, link} = JSON.parse(item.payload);
    return {
      account,
      content,
      link,
      ms: item.ms,
    }
  }

  const rtmMessages = useMemo(() => {
    if (!value) return [];
    return value
    .filter((it: any) => it.payload)
    .map(serializeMessage);
  }, [value]);

  const replayMessages = useMemo(() => {
    if (props.startTime && state === RtmPlayerState.load && rtmMessages && rtmMessages.length) {
      const time = +props.startTime + currentSeekTime;
      return rtmMessages.filter((it: any) => (time >= it.ms));
    }
    return [];
  }, [JSON.stringify([rtmMessages.length, currentSeekTime, state, props.startTime])]);

  const scrollDown = (current: any) => {
    current.scrollTop = current.scrollHeight;
  }

  useEffect(() => {
    scrollDown(ref.current);
  }, [replayMessages.length]);

  const MessageList = useCallback(() => {
    if (replayMessages) {
      return (
        <Fragment>
          {
          replayMessages
          .map((item: any, key: number) => 
          (<Message key={key} nickname={item.account} content={item.content} link={item.link}>
          </Message>)
          )}
        </Fragment>
      )
    }
    return null;
  }, [replayMessages.length]);

  return (
    <div className="chat-messages" ref={ref}>
      {state !== RtmPlayerState.load ? null : 
        <MessageList></MessageList>
      }
    </div>
  )
}

export const RTMReplayer = React.memo(RtmPlayer);