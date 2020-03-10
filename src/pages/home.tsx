import React, { useState, useEffect, useRef } from 'react';
import { Theme, FormControl } from '@material-ui/core';
import {makeStyles} from '@material-ui/core/styles';
import Button from '../components/custom-button';
import RoleRadio from '../components/role-radio';
import Icon from '../components/icon';
import FormInput from '../components/form-input';
import FormSelect from '../components/form-select';
import LangSelect from '../components/lang-select';
import { isElectron } from '../utils/platform';
import { usePlatform } from '../containers/platform-container';
import {useHistory} from 'react-router-dom';
import { roomStore } from '../stores/room';
import { genUid } from '../utils/helper';
import MD5 from 'js-md5';
import { globalStore, roomTypes } from '../stores/global';
import { t } from '../i18n';
import GlobalStorage from '../utils/custom-storage';

const useStyles = makeStyles ((theme: Theme) => ({
  formControl: {
    minWidth: '240px',
    maxWidth: '240px',
  }
}));

type SessionInfo = {
  roomName: string
  roomType: number
  yourName: string
  role: string
}

const defaultState: SessionInfo = {
  roomName: '',
  roomType: 1,
  role: '',
  yourName: '',
}

function HomePage() {
  const classes = useStyles();

  const history = useHistory();

  const handleSetting = (evt: any) => {
    history.push({pathname: `/device_test`});
  }

  const {
    HomeBtn
  } = usePlatform();

  const ref = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      ref.current = true;
    }
  }, []);

  const [session, setSessionInfo] = useState<SessionInfo>(defaultState);

  const [required, setRequired] = useState<any>({} as any);

  const handleSubmit = () => {
    if (!session.roomName) {
      setRequired({...required, roomName: t('home.missing_room_name')});
      return;
    }

    if (!session.yourName) {
      setRequired({...required, yourName: t('home.missing_your_name')});
      return;
    }

    if (!session.role) {
      setRequired({...required, role: t('home.missing_role')});
      return;
    }
    
    if (!roomTypes[session.roomType]) return;
    const path = roomTypes[session.roomType].path
    const payload = {
      uid: genUid(),
      rid: `${session.roomType}${MD5(session.roomName)}`,
      role: session.role,
      roomName: session.roomName,
      roomType: session.roomType,
      video: 1,
      audio: 1,
      chat: 1,
      account: session.yourName,
      rtmToken: '',
      boardId: '',
      linkId: 0,
      sharedId: 0,
      lockBoard: 0,
      grantBoard: 0,
    }
    ref.current = true;
    globalStore.showLoading();
    roomStore.loginAndJoin(payload).then(() => {
      history.push(`/meeting/${path}`);
    }).catch((err: any) => {
      if (err.reason) {
        globalStore.showToast({
          type: 'rtmClient',
          message: t('toast.rtm_login_failed_reason', {reason: err.reason}),
        })
      } else {
        globalStore.showToast({
          type: 'rtmClient',
          message: t('toast.rtm_login_failed'),
        })
      }
      console.warn(err);
    })
    .finally(() => {
        ref.current = false;
        globalStore.stopLoading();
    })
  }

  return (
    <div className={`flex-container ${isElectron ? 'draggable' : 'home-cover-web' }`}>
      {isElectron ? null : 
      <div className="web-menu">
        <div className="web-menu-container">
          <div className="short-title">
            <span className="title">{t('home.short_title.title')}</span>
            <span className="subtitle">{t('home.short_title.subtitle')}</span>
            <span className="build-version">{t("build_version")}</span>
          </div>
          <div className="setting-container">
            <Icon className="icon-setting" onClick={handleSetting}/>
            <LangSelect
            value={GlobalStorage.getLanguage().language !== 'zh-CN' ? 1 : 0}
            onChange={(evt: any) => {
              const value = evt.target.value;
              if (value === 0) {
                globalStore.setLanguage('zh-CN');
              } else {
                globalStore.setLanguage('en');
              }
            }}
            items={[
              {text: '中文', name: 'zh-CN'},
              {text: 'En', name: 'en'}
            ]}></LangSelect>
          </div>
        </div>
      </div>
      }
      <div className="custom-card">
        <div className="flex-item cover">
          {isElectron ? 
          <>
          <div className={`short-title ${globalStore.state.language}`}>
            <span className="title">{t('home.short_title.title')}</span>
            <span className="subtitle">{t('home.short_title.subtitle')}</span>
          </div>
          <div className={`cover-placeholder ${t('home.cover_class')}`}></div>
          <div className='build-version'>{t("build_version")}</div>
          </>
          : <div className={`cover-placeholder-web ${t('home.cover_class')}`}></div>
          }
        </div>
        <div className="flex-item card">
          <div className="position-top card-menu">
            <HomeBtn handleSetting={handleSetting}/>
          </div>
          <div className="position-content flex-direction-column">
            <FormControl className={classes.formControl}>
              <FormInput Label={t('home.room_name')} value={session.roomName} onChange={
                (val: string) => {
                  setSessionInfo({
                    ...session,
                    roomName: val
                  });
                }}
                requiredText={required.roomName}
              />
            </FormControl>
            <FormControl className={classes.formControl}>
              <FormInput Label={t('home.nickname')} value={session.yourName} onChange={
                (val: string) => {
                  setSessionInfo({
                    ...session,
                    yourName: val
                  });
                }}
                requiredText={required.yourName}
              />
            </FormControl>
            {/* <FormControl className={classes.formControl}>
              <FormSelect 
                Label={t('home.room_type')}
                value={session.roomType}
                onChange={(evt: any) => {
                  setSessionInfo({
                    ...session,
                    roomType: evt.target.value
                  });
                }}
                items={roomTypes.map((it: any) => ({
                  value: it.value,
                  text: t(`${it.text}`),
                  path: it.path
                }))}
              />
            </FormControl> */}
            <FormControl className={classes.formControl}>
              <RoleRadio value={session.role} onChange={(evt: any) => {
                 setSessionInfo({
                   ...session,
                   role: evt.target.value
                 });
              }} requiredText={required.role}></RoleRadio>
            </FormControl>
            <Button name={t('home.room_join')} onClick={handleSubmit}/>
          </div>
        </div>
      </div>
    </div>
  )
}
export default React.memo(HomePage);