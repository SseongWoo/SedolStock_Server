import { google } from 'googleapis';
import { db } from '../firebase_admin.js';
import dotenv from 'dotenv';
import { getJson } from '../utils/file.js'

dotenv.config({ path: '../.env' });
const apiKey = process.env.YOUTUBE_API_KEY;

// YouTube API 인스턴스를 생성합니다.
const youtube = google.youtube({
    version: 'v3',
    auth: apiKey
});
const channelIdList = process.env.CHANNEL_ID_LIST.split(',');


// 유튜브 채널의 uid 가져오기
export async function getChannelIdByName(req, res) {
    const { channelName } = req.body;

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
            return res.status(200).json({ message: `Channel ID for "${channelName}" found`, channelId: channelId });
        } else {
            return res.status(404).json({ message: `No channel found with the name: ${channelName}` });
        }
    } catch (error) {
        console.error('Error fetching channel ID:', error);
        return res.status(500).json({ message: 'Error fetching channel ID', error: error.message });
    }
}



export async function getChannelInfoData(req, res) {
    try {
        // // Firestore에서 특정 문서(채널 ID '0')에 해당하는 데이터 가져오기
        // const channelDoc = await db.collection('youtubechannels').doc('0').get();

        // // 문서가 존재하는지 확인
        // if (!channelDoc.exists) {
        //     return res.status(404).json({
        //         message: 'No channel information found for the requested ID.'
        //     });
        // }

        const channelDoc = await getJson('../json/channelInfo.json');

        // 데이터 확인
        if (!doc || Object.keys(doc).length === 0) {
            console.error('No data found in JSON file for "videoList.json".');
            return res.status(404).json({
                message: 'No channel information found for the requested ID.'
            });
        }


        // 응답 전송
        return res.status(200).json({
            message: `Channel information retrieved successfully.`,
            channel: channelDoc
        });

    } catch (error) {
        console.error('Error retrieving channel information:', error);
        return res.status(500).json({ message: 'Error retrieving channel information', error: error.message });
    }
}



export async function getVideoData(req, res) {
    try {
        // // Firestore에서 특정 문서(채널 ID '0')에 해당하는 데이터 가져오기
        // const videoDoc = await db.collection('youtubevideos').doc('0').get();

        // // 문서가 존재하는지 확인
        // if (!videoDoc.exists) {
        //     return res.status(404).json({
        //         message: 'No video data found for the requested ID.'
        //     });
        // }

        const videoDoc = await getJson('../json/videoList.json');

        // 데이터 확인
        if (!videoDoc || Object.keys(videoDoc).length === 0) {
            console.error('No data found in JSON file for "videoList.json".');
            return res.status(404).json({
                message: 'No video data found for the requested ID.'
            });
        }

        // 응답 전송
        return res.status(200).json({
            message: `video data retrieved successfully.`,
            channel: videoDoc
        });

    } catch (error) {
        console.error('Error retrieving video data:', error);
        return res.status(500).json({ message: 'Error retrieving video data', error: error.message });
    }
}

export async function getLiveData(req, res) {
    try {
        // Firestore에서 데이터 가져오기
        // const lastDoc = await db.collection('youtubelivedata').doc('0').get();
        // const lastSubDoc = await db.collection('youtubelivedata').doc('0_sub').get();
        // const chartDataDoc = await db.collection('youtubelivedata').doc('0_chart').get();


        // // 데이터가 존재하는지 확인
        // if (!lastDoc.exists) {
        //     return res.status(404).json({ message: 'No data found in Firestore for document "0"' });
        // }

        // if (!lastSubDoc.exists) {
        //     return res.status(404).json({ message: 'No chart data found in Firestore for document "0_chart"' });
        // }

        // if (!chartDataDoc.exists) {
        //     return res.status(404).json({ message: 'No chart data found in Firestore for document "0_chart"' });
        // }

        const countMapData = await getJson('../json/liveData.json');
        const countSubMapData = await getJson('../json/liveSubData.json');
        const chartDataList = await getJson('../json/liveChart.json');

        if (!countMapData || Object.keys(countMapData).length === 0) {
            return res.status(404).json({ message: 'No data found in Firestore for document "0"' });
        }

        if (!countSubMapData || Object.keys(countSubMapData).length === 0) {
            return res.status(404).json({ message: 'No chart data found in Firestore for document "0_chart"' });
        }

        if (!chartDataList || Object.keys(countMapData).length === 0) {
            return res.status(404).json({ message: 'No chart data found in Firestore for document "0_chart"' });
        }

        // Firestore에서 가져온 데이터
        // const countMapData = lastDoc.data() || {};
        // const countSubMapData = lastSubDoc.data() || {};
        // const chartDataList = chartDataDoc.data() || {};

        // 응답 전송
        return res.status(200).json({
            message: 'Live data and chart data retrieved successfully.',
            countMapData: countMapData,
            chartDataList: chartDataList,
            countSubMapData: countSubMapData
        });

    } catch (error) {
        console.error('Error retrieving data from Firestore:', error);
        return res.status(500).json({ message: 'Error retrieving data from Firestore', error: error.message });
    }
}

export async function getLatestVideoInfo(req, res) {
    try {
        // // Firestore에서 최신 비디오 정보 가져오기
        // const doc = await db.collection('youtubevideos').doc('0_latest').get();

        // // 문서가 존재하는지 확인
        // if (!doc.exists) {
        //     return res.status(404).json({ message: 'No latest video data found.' });
        // }

        // // 문서 데이터 가져오기
        // const videoData = doc.data();

        const videoData = await getJson('../json/videoLatestList.json');

        if (!videoData || Object.keys(videoData).length === 0) {
            return res.status(404).json({ message: 'No latest video data found.' });
        }

        // JSON 응답 전송
        return res.status(200).json({
            message: 'Latest video data retrieved successfully.',
            videos: videoData
        });

    } catch (error) {
        console.error('Error retrieving latest video data:', error);
        return res.status(500).json({ message: 'Error retrieving latest video data', error: error.message });
    }
}