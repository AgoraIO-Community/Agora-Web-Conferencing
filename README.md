# [ARCHIVED] Agora Web Conference Sample demo  

**⚠️ This project is no longer maintained and has been archived.**  
Please note that this repository is now in a read-only state and will not receive any further updates or support.

We recommend using to the latest version of the **Agora Web SDK**: [Learn more](https://www.agora.io/en/products/video-call/) 

For documentation and support, please visit the [Agora Documentation](https://docs.agora.io/en/).

---

### Live demo: [link](https://agora-web-conferencing.netlify.com/)

## Steps to run the demo:

### Create the environment file

**Create a file named `.env.local` in the root directory and add the following**

**Change only the APP_ID (first field)**

```
REACT_APP_AGORA_APP_ID= <--- app id here --->
REACT_APP_AGORA_LOG=true
REACT_APP_NETLESS_APP_TOKEN=token
REACT_APP_NETLESS_APP_API_ENTRY=https://cloudcapiv4.herewhite.com/room?token=
REACT_APP_NETLESS_APP_JOIN_API=https://cloudcapiv4.herewhite.com/room/join?token=
REACT_APP_AGORA_RECORDING_OSS_URL=oss_url
#REACT_APP_AGORA_RECORDING_SERVICE_URL=https://api.agora.io/v1/apps/%s/cloud_recording
REACT_APP_AGORA_RECORDING_SERVICE_URL=https://apiagoraio.herewhite.com
ELECTRON_START_URL=http://localhost:3000
REACT_APP_AGORA_CUSTOMER_ID=customer_id
REACT_APP_AGORA_CUSTOMER_CERTIFICATE=customer_certificate
REACT_APP_AGORA_OSS_BUCKET_NAME=your_oss_bucket_name
REACT_APP_AGORA_OSS_BUCKET_FOLDER=your_oss_bucket_folder
REACT_APP_AGORA_OSS_BUCKET_REGION=your_bucket_region
REACT_APP_AGORA_OSS_BUCKET_KEY=your_bucket_ak
REACT_APP_AGORA_OSS_BUCKET_SECRET=your_bucket_sk
```

### Run `npm run dev` to serve the website on a development server
