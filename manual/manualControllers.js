import { google } from 'googleapis';
import { db } from '../firebase_admin.js';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { getJson } from '../utils/file.js'

// 현재 파일의 디렉터리 이름을 얻기
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
const apiKey = process.env.YOUTUBE_API_KEY;

// YouTube API 인스턴스를 생성합니다.
const youtube = google.youtube({
    version: 'v3',
    auth: apiKey
});

// 유튜브 채널의 uid 가져오기
export async function getChannelIdByName(channelName) {

    if (!channelName) {
        return res.status(400).json({ message: 'channelName is required' });
    }

    try {
        // YouTube Data API를 사용하여 채널 검색
        const response = await youtube.search.list({
            part: 'snippet',
            q: channelName,          // 검색어로 채널 이름을 입력
            type: 'channel',         // 채널 유형으로 제한
            maxResults: 1            // 첫 번째 검색 결과만 가져옵니다.
        });

        // 검색 결과에서 채널 ID 추출
        const channels = response.data.items;
        if (channels.length > 0) {
            const channelId = channels[0].snippet.channelId;
            console.log(channelId);
        } else {
            console.error('Error fetching channel ID');
        }
    } catch (error) {
        console.error('Error fetching channel ID:', error);
    }
}

export async function setEvent() {
    const newEvent = {
        eventstart: "2025-01-15",
        eventend: "2025-01-20",
        channel: ["UCZOcwheypMvYN_J2oRBgt2A"],
        multiplier: 2,
        title: "왁타버스 제로 복귀 기념 2배 이벤트",
        description: "왁타버스 제로 채널이 돌아온 기념"
    };

    // 진행 중인 이벤트에 추가
    await db.collection('config').doc('event').collection('upcoming').add(newEvent);
}