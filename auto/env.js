import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 현재 파일의 디렉터리 이름을 얻기
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env 파일 경로 설정
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// 변수 선언
const serviceAccountURL = process.env.FIREBASE_ADMIN_AUTO_SERVICE_ACCOUNT;
const storageBucketURL = process.env.FIREBASE_ADMIN_STORAGE_BUCKET;
const apiKey = process.env.YOUTUBE_API_KEY;
const channelIdList = process.env.CHANNEL_ID_LIST ? process.env.CHANNEL_ID_LIST.split(',') : [];

// 환경 변수 값 디버깅
console.log(serviceAccountURL, storageBucketURL, apiKey, channelIdList);

// 변수 export
export { serviceAccountURL, storageBucketURL, apiKey, channelIdList };

