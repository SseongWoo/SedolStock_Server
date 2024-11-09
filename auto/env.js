import dotenv from 'dotenv';
dotenv.config({ path: '/home/ec2-user/sp/SP/.env' }); // .env 파일 로드

// 변수 선언
const serviceAccountURL = process.env.FIREBASE_ADMIN_AUTO_SERVICE_ACCOUNT;
const storageBucketURL = process.env.FIREBASE_ADMIN_STORAGE_BUCKET;
const apiKey = process.env.YOUTUBE_API_KEY;
const channelIdList = process.env.CHANNEL_ID_LIST ? process.env.CHANNEL_ID_LIST.split(',') : [];

// 환경 변수 값 디버깅
console.log(serviceAccountURL, storageBucketURL, apiKey, channelIdList);

// 변수 export
export { serviceAccountURL, storageBucketURL, apiKey, channelIdList };

