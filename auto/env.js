import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
console.log(serviceAccountURL, storageBucketURL, apiKey, channelIdList);

export const serviceAccountURL = process.env.FIREBASE_ADMIN_AUTO_SERVICE_ACCOUNT;
export const storageBucketURL = process.env.FIREBASE_ADMIN_STORAGE_BUCKET;
export const apiKey = process.env.YOUTUBE_API_KEY;
export const channelIdList = process.env.CHANNEL_ID_LIST.split(',');

