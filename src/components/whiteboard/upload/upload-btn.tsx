import React from 'react';
import OSS from "ali-oss";
import uuidv4 from 'uuid/v4';
import { PPTProgressListener, UploadManager } from "../../../utils/upload-manager";
import { PptKind, Room } from "white-web-sdk";
import { ossConfig, ossClient, resolveFileInfo } from '../../../utils/helper';
import { whiteboard } from '../../../stores/whiteboard';

export type UploadBtnProps = {
  room: Room,
  uuid: string,
  roomToken: string,
  onProgress?: PPTProgressListener,
  onFailure?: (err: any) => void,
  onSuccess?: () => void,
};

export const UploadBtn: React.FC<UploadBtnProps> = ({
  room, uuid, roomToken,
  onProgress, onFailure,
  onSuccess
}) => {
  const uploadDynamic = async (event: any) => {
    try {
      const file = event.currentTarget.files[0];
      if (file) {
        const uploadManager = new UploadManager(ossClient, room);
        const pptConverter = whiteboard.client.pptConverter(roomToken);
        await uploadManager.convertFile(
          file,
          pptConverter,
          PptKind.Dynamic,
          ossConfig.folder,
          uuid,
          onProgress,
        );
        onSuccess && onSuccess();
      }
    } catch (err) {
      onFailure && onFailure(err);
      console.warn(err)
    }
  }

  const uploadStatic = async (event: any) => {
    try {
      const file = event.currentTarget.files[0];
      if (file) {
        const uploadManager = new UploadManager(ossClient, room);
        const pptConverter = whiteboard.client.pptConverter(roomToken);
        await uploadManager.convertFile(
          file,
          pptConverter,
          PptKind.Static,
          ossConfig.folder,
          uuid,
          onProgress);
        onSuccess && onSuccess();
      }
    } catch (err) {
      onFailure && onFailure(err)
      console.warn(err)
    }
  }

  const uploadImage = async (event: any) => {
    try {
      const file = event.currentTarget.files[0];
      if (file) {
        const uploadFileArray: File[] = [];
        uploadFileArray.push(file);
        const uploadManager = new UploadManager(ossClient, room);
        const $whiteboard = document.getElementById('whiteboard') as HTMLDivElement;
        if ($whiteboard) {
          const { clientWidth, clientHeight } = $whiteboard;
          await uploadManager.uploadImageFiles(uploadFileArray, clientWidth / 2, clientHeight / 2, onProgress);
        } else {
          const clientWidth = window.innerWidth;
          const clientHeight = window.innerHeight;
          await uploadManager.uploadImageFiles(uploadFileArray, clientWidth / 2, clientHeight / 2, onProgress);
        }
        onSuccess && onSuccess();
      }
    } catch (err) {
      onFailure && onFailure(err)
      console.warn(err)
    }
  }

  const uploadAudioVideo = async (event: any) => {
    const uploadManager = new UploadManager(ossClient, room);
    const file = event.currentTarget.files[0];
    if (file) {
      try {
        const {fileName, fileType} = resolveFileInfo(file);
        const path = `/${ossConfig.folder}`
        const uuid = uuidv4();
        const res = await uploadManager.addFile(`${path}/video-${fileName}${uuid}`, file,
          onProgress
        );
        const isHttps = res.indexOf("https") !== -1;
        let url;
        if (isHttps) {
          url = res;
        } else {
          url = res.replace("http", "https");
        }
        const type = fileType.split(".")[1];
        if (url && whiteboard.state.room) {
          if (type.toLowerCase() === 'mp4') {
            const res = whiteboard.state.room.insertPlugin('video', {
              originX: 0,
              originY: 0,
              width: 480,
              height: 270,
              attributes: {
                  pluginVideoUrl: url,
              },
            });
            console.log("[upload-btn] video resource after insert plugin, res: ", res);
          }
          if (type.toLowerCase() === 'mp3') {
            const res = whiteboard.state.room.insertPlugin('audio', {
              originX: 0,
              originY: 0,
              width: 480,
              height: 86,
              attributes: {
                  pluginAudioUrl: url,
              },
            });
            console.log("[upload-btn] audio resource after insert plugin, res: ", res);
          }
          onSuccess && onSuccess();
        }
      } catch(err) {
        onFailure && onFailure(err);
      }
    }
  }

  return (
    <div className="upload-btn">
      <div className="upload-items">
        <label htmlFor="upload-image">
          <div className="upload-image-resource"></div>
          <div className="text-container">
            <div className="title">Convert Picture</div>
            <div className="description">bmp, jpg, png, gif</div>
          </div>
        </label>
        <input id="upload-image" accept="image/*,.bmp,.jpg,.png,.gif"
          onChange={uploadImage} type="file"></input>
      </div>
      <div className="slice-dash"></div>
      <div className="upload-items">
        <label htmlFor="upload-dynamic">
          <div className="upload-dynamic-resource"></div>
          <div className="text-container">
            <div className="title">Convert to Webpage</div>
            <div className="description">pptx only support</div>
          </div>
        </label>
        <input id="upload-dynamic" accept=".pptx" onChange={uploadDynamic} type="file"></input>
      </div>
      <div className="slice-dash"></div>
      <div className="upload-items">
        <label htmlFor="upload-static">
          <div className="upload-static-resource"></div>
          <div className="text-container">
            <div className="title">Convert to picture</div>
            <div className="description">pptx, word, pdf support</div>
          </div>
        </label>
        <input id="upload-static" accept=".doc,.docx,.ppt,.pptx,.pdf" onChange={uploadStatic} type="file"></input>
      </div>
      <div className="slice-dash"></div>
      <div className="upload-items">
        <label htmlFor="upload-video">
          <div className="upload-static-resource"></div>
          <div className="text-container">
            <div className="title">Upload audio/video</div>
            <div className="description">mp4,mp3</div>
          </div>
        </label>
        <input id="upload-video" accept=".mp4,.mp3" onChange={uploadAudioVideo} type="file"></input>
      </div>
    </div>
  )
}