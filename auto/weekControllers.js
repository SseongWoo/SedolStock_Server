import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// 현재 파일의 디렉터리 이름을 얻기
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env 파일 경로 설정
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import { google } from 'googleapis';
import { db } from '../firebase_admin.js';
import { updateJson } from '../utils/file.js'

const apiKey = process.env.YOUTUBE_API_KEY;
const channelIdList = process.env.CHANNEL_ID_LIST ? process.env.CHANNEL_ID_LIST.split(',') : [];

// YouTube API 인스턴스를 생성합니다.
const youtube = google.youtube({
    version: 'v3',
    auth: apiKey
});

// 채널 정보를 가져오고 Firestore에 저장하는 함수
export async function updateChannelInfoData() {
    try {
        // YouTube API 요청을 병렬로 처리하여 채널 정보 가져오기
        const channelPromises = channelIdList.map(channelId => {
            return youtube.channels.list({
                part: 'snippet,statistics',
                id: channelId
            });
        });

        // 모든 채널 정보 요청을 동시에 처리
        const responses = await Promise.all(channelPromises);

        // 각 채널 정보에서 데이터 추출
        const channelDataList = responses.map((response, index) => {
            const channel = response.data.items[0];
            if (channel) {
                return {
                    uid: channelIdList[index],
                    title: channel.snippet.title,
                    description: channel.snippet.description,
                    subscribercount: channel.statistics.subscriberCount,
                    thumbnails: channel.snippet.thumbnails.medium.url,
                };
            } else {
                return null; // 채널 정보가 없을 경우 null
            }
        }).filter(data => data !== null); // null 데이터를 필터링하여 제외

        // Firestore에 각 채널 정보 저장 (병렬 처리)
        const firestorePromises = channelDataList.map(channelData => {
            return db.collection('youtubechannels').doc(channelData.uid).set(channelData);
        });

        await Promise.all(firestorePromises);

        // channelDataList는 채널 데이터 객체들을 담고 있는 배열이라고 가정합니다.
        const channelDataMap = new Map();

        // channelDataList를 순회하며 uid를 key로 하고 나머지 데이터를 value로 Map에 추가합니다.
        channelDataList.forEach(data => {
            const key = data.uid;  // key는 uid
            const value = {
                uid: data.uid,
                title: data.title,
                description: data.description,
                subscribercount: data.subscribercount,
                thumbnails: data.thumbnails,
            };
            channelDataMap.set(key, value);
        });

        // Firestore에 저장하기 위해 Map을 순수한 JavaScript 객체로 변환
        const channelDataObject = Object.fromEntries(channelDataMap);

        await updateJson('../json/channelInfo.json', channelDataObject);

        await db.collection('youtubechannels').doc('0').set(channelDataObject);

        // 응답 전송
        console.log('Channel information has been saved successfully.');
        return;

    } catch (error) {
        console.error('Error fetching channel information:', error);
        return;
    }
}