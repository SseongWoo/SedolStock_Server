//AIzaSyDBjkLDGGibdXHlIU3mQGoUrZNxkfa-NeU
import { google } from 'googleapis';
import { db } from '../firebase_admin.js';
import { getDate, getTime } from '../utils/date.js';


// YouTube API 인스턴스를 생성합니다.
const youtube = google.youtube({
    version: 'v3',
    auth: 'AIzaSyDBjkLDGGibdXHlIU3mQGoUrZNxkfa-NeU' // 실제 API 키를 여기에 입력하세요.
});

const channelIdList = [
    'UC2b4WRE5BZ6SIUWBeJU8rwg', 'UCIVFv8AiQLqM9oLHTixrNYw', 'UCKzfyYWHQ92z_2jUcSABM8Q',
    'UClbYIn9LDbbFZ9w2shX3K0g', 'UCAHVQ44O81aehLWfy9O6Elw', 'UC_eeSpMBz8PG4ssdBPnP07g',
    'UC1afpiIuBDcjYlmruAa0HiA', 'UC7-m6jQLinZQWIbwm9W-1iw', 'UCQmcltnre6aG9SkDRYZqFIg',
    'UCYxLMfeX1CbMBll9MsGlzmw', 'UCcA21_PzN1EhNe7xS4MJGsQ', 'UCj0c1jUr91dTetIQP2pFeLA'
];

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

// 채널 정보를 가져오고 Firestore에 저장하는 함수
export async function updateChannelInfoData() {
    const channelBirthDay = [
        '12.21', '11.15', '12.02', '05.21', '09.07', '02.22',
        '01.05', '10.01', '05.03', '03.21', '08.07', '04.13'
    ];

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
                    birthday: channelBirthDay[index],
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
                birthday: data.birthday
            };
            channelDataMap.set(key, value);
        });

        // Firestore에 저장하기 위해 Map을 순수한 JavaScript 객체로 변환
        const channelDataObject = Object.fromEntries(channelDataMap);

        await db.collection('youtubechannels').doc('0').set(channelDataObject);

        // 응답 전송
        console.log('Channel information has been saved successfully.');
        return;

    } catch (error) {
        console.error('Error fetching channel information:', error);
        return;
    }
}

export async function getChannelInfoData(req, res) {
    try {
        // Firestore에서 특정 문서(채널 ID '0')에 해당하는 데이터 가져오기
        const channelDoc = await db.collection('youtubechannels').doc('0').get();

        // 문서가 존재하는지 확인
        if (!channelDoc.exists) {
            return res.status(404).json({
                message: 'No channel information found for the requested ID.'
            });
        }

        // 응답 전송
        return res.status(200).json({
            message: `Channel information retrieved successfully.`,
            channel: channelDoc.data()
        });

    } catch (error) {
        console.error('Error retrieving channel information:', error);
        return res.status(500).json({ message: 'Error retrieving channel information', error: error.message });
    }
}

export async function updateVideoData() {
    try {
        // 각 채널에 대해 비디오 데이터 가져오기
        const videoPromises = channelIdList.map(async (channelId) => {
            try {
                // 채널의 최신 10개 영상을 가져오기 위해 검색 API 호출
                const searchResponse = await youtube.search.list({
                    part: 'snippet',
                    channelId: channelId,
                    maxResults: 10,
                    order: 'date',
                    type: 'video'
                });

                const videoIds = searchResponse.data.items.map(item => item.id.videoId);

                if (videoIds.length > 0) {
                    // 가져온 videoIds를 사용하여 각 영상의 상세 정보를 가져옵니다.
                    const videoResponse = await youtube.videos.list({
                        part: 'snippet,statistics',
                        id: videoIds.join(',')
                    });

                    const videoDataList = videoResponse.data.items.map((video) => ({
                        videoid: video.id,
                        title: video.snippet.title,
                        description: video.snippet.description,
                        thumbnailurl: video.snippet.thumbnails?.medium?.url || '',
                        publishedat: video.snippet.publishedAt,
                    }));

                    // Firestore에 병렬로 저장
                    const batch = db.batch();

                    const historyRef = db.collection('youtubevideos').doc(channelId).collection('history').doc(getDate());
                    //const latestRef = db.collection('youtubevideos').doc(channelId).collection('latest').doc('videodatalist');
                    const combinRef = db.collection('youtubevideos').doc('0');

                    batch.set(historyRef, { videos: videoDataList });
                    //batch.set(latestRef, { videos: videoDataList });
                    batch.update(combinRef, { [channelId]: videoDataList })

                    // Firestore 배치 실행
                    await batch.commit();
                }
            } catch (err) {
                console.error(`Error processing channel ${channelId}:`, err);
            }
        });

        // 모든 채널의 영상 데이터를 병렬로 처리
        await Promise.all(videoPromises);

        // 응답 전송
        console.log('Latest 10 videos for each channel have been saved successfully.');
        return;

    } catch (error) {
        console.error('Error saving latest videos:', error);
        return;
    }
}

export async function getVideoData(req, res) {
    try {
        // Firestore에서 특정 문서(채널 ID '0')에 해당하는 데이터 가져오기
        const videoDoc = await db.collection('youtubevideos').doc('0').get();

        // 문서가 존재하는지 확인
        if (!videoDoc.exists) {
            return res.status(404).json({
                message: 'No video data found for the requested ID.'
            });
        }

        // 응답 전송
        return res.status(200).json({
            message: `video data retrieved successfully.`,
            channel: videoDoc.data()
        });

    } catch (error) {
        console.error('Error retrieving video data:', error);
        return res.status(500).json({ message: 'Error retrieving video data', error: error.message });
    }
}

export async function updateLiveData() {
    try {
        const lastDoc = await db.collection('youtubelivedata').doc('0').get();
        const countMapData = lastDoc.data() || {};

        const chartDataDoc = await db.collection('youtubelivedata').doc('0_chart').get();
        const chartDataList = chartDataDoc.data() || {};

        const doc = await db.collection('youtubevideos').doc('0').get();
        if (!doc.exists) {
            console.error('message: No data found in Firestore for document "0"');
            return;
        }

        const channelDataObject = doc.data();
        const videoIdsByChannel = {};
        const countMap = {};

        // 각 채널의 비디오 ID 추출
        Object.keys(channelDataObject).forEach(channelId => {
            const videoDataList = channelDataObject[channelId];
            const videoIds = videoDataList.map(video => video.videoid);
            videoIdsByChannel[channelId] = videoIds;
        });

        for (const channelItem of channelIdList) {
            try {
                const videoIds = videoIdsByChannel[channelItem]?.join(',');
                if (!videoIds) {
                    console.warn(`No video IDs found for channel: ${channelItem}`);
                    continue;
                }

                const response = await youtube.videos.list({
                    id: videoIds,
                    part: 'statistics'
                });

                const existingData = countMapData[channelItem] || {};

                countMap[channelItem] = {
                    totalViewCount: 0,
                    totalLikeCount: 0,
                    totalCommentCount: 0,
                    lastTotalViewCount: existingData.totalViewCount || 0,
                    lastTotalLikeCount: existingData.totalLikeCount || 0,
                    lastTotalCommentCount: existingData.totalCommentCount || 0,
                    lastDifferenceViewCount: existingData.differenceViewCount || 0,
                    lastDifferenceLikeCount: existingData.differenceLikeCount || 0,
                    lastDifferenceCommentCount: existingData.differenceCommentCount || 0,
                    differenceViewCount: 0,
                    differenceLikeCount: 0,
                    differenceCommentCount: 0,
                    lastViewCountPrice: existingData.viewCountPrice || 10000,
                    lastLikeCountPrice: existingData.likeCountPrice || 10000,
                    lastCommentCountPrice: existingData.commentCountPrice || 10000,
                    viewCountPrice: 0,
                    likeCountPrice: 0,
                    commentCountPrice: 0,
                    updateTime: getTime(),
                };

                for (const video of response.data.items) {
                    const statistics = video.statistics;
                    countMap[channelItem].totalViewCount += parseInt(statistics.viewCount, 10) || 0;
                    countMap[channelItem].totalLikeCount += parseInt(statistics.likeCount, 10) || 0;
                    countMap[channelItem].totalCommentCount += parseInt(statistics.commentCount, 10) || 0;
                }

                countMap[channelItem].differenceViewCount = countMap[channelItem].totalViewCount - countMap[channelItem].lastTotalViewCount;
                countMap[channelItem].differenceLikeCount = countMap[channelItem].totalLikeCount - countMap[channelItem].lastTotalLikeCount;
                countMap[channelItem].differenceCommentCount = countMap[channelItem].totalCommentCount - countMap[channelItem].lastTotalCommentCount;

                countMap[channelItem].viewCountPrice = countMap[channelItem].lastViewCountPrice - (countMap[channelItem].differenceViewCount - countMap[channelItem].lastDifferenceViewCount);
                countMap[channelItem].likeCountPrice = countMap[channelItem].lastLikeCountPrice - (countMap[channelItem].differenceLikeCount - countMap[channelItem].lastDifferenceLikeCount);
                countMap[channelItem].commentCountPrice = countMap[channelItem].lastCommentCountPrice - (countMap[channelItem].differenceCommentCount - countMap[channelItem].lastDifferenceCommentCount);

                if (!chartDataList[channelItem]) {
                    chartDataList[channelItem] = {
                        viewCount: [],
                        likeCount: [],
                        commentCount: []
                    };  // 초기화
                }

                // 최대 144개 데이터까지만 저장 (기존 리스트에서 오래된 데이터 삭제)
                if (chartDataList[channelItem].viewCount.length > 144) {
                    chartDataList[channelItem].viewCount.shift();
                    chartDataList[channelItem].likeCount.shift();
                    chartDataList[channelItem].commentCount.shift();
                }

                // 각 통계값을 리스트에 추가
                chartDataList[channelItem].viewCount.push(countMap[channelItem].viewCountPrice);
                chartDataList[channelItem].likeCount.push(countMap[channelItem].likeCountPrice);
                chartDataList[channelItem].commentCount.push(countMap[channelItem].commentCountPrice);

            } catch (error) {
                console.error(`비디오 통계 정보를 가져오는 중 오류 발생 for channel ${channelItem}: `, error);
            }
        }

        await db.collection('youtubelivedata').doc('0_chart').set(chartDataList, { merge: true });
        await db.collection('youtubelivedata').doc('history_chart').collection(getDate()).doc(getTime()).set(chartDataList, { merge: true });
        await db.collection('youtubelivedata').doc('0').set(countMap, { merge: true });
        await db.collection('youtubelivedata').doc('history').collection(getDate()).doc(getTime()).set(countMap);

        console.log('message: All video IDs grouped by channel ID retrieved successfully.');
        return

    } catch (error) {
        console.error('Error retrieving video IDs by channel ID:', error);
        return;
    }
}

export async function getLiveData(req, res) {
    try {
        // Firestore에서 데이터 가져오기
        const lastDoc = await db.collection('youtubelivedata').doc('0').get();
        const chartDataDoc = await db.collection('youtubelivedata').doc('0_chart').get();

        // 데이터가 존재하는지 확인
        if (!lastDoc.exists) {
            return res.status(404).json({ message: 'No data found in Firestore for document "0"' });
        }

        if (!chartDataDoc.exists) {
            return res.status(404).json({ message: 'No chart data found in Firestore for document "0_chart"' });
        }

        // Firestore에서 가져온 데이터
        const countMapData = lastDoc.data() || {};
        const chartDataList = chartDataDoc.data() || {};

        // 응답 전송
        return res.status(200).json({
            message: 'Live data and chart data retrieved successfully.',
            countMapData: countMapData,
            chartDataList: chartDataList
        });

    } catch (error) {
        console.error('Error retrieving data from Firestore:', error);
        return res.status(500).json({ message: 'Error retrieving data from Firestore', error: error.message });
    }
}


export async function testFunction(req, res) {
    //////
    // 앞에 youtubelivedata - 0 에 있는 데이터들을 먼저 가져온뒤 아래 코드 진행
    //////

    try {
        // 직전 데이터 가져오기
        const lastDoc = await db.collection('youtubelivedata').doc('0').get();

        const countMapData = lastDoc.data();

        console.log(countMapData[channelIdList[0]].totalCommentCount);

        // 응답 전송
        return res.status(200).json({
            message: 'All video IDs grouped by channel ID retrieved successfully.',
            lastCountMap: countMapData
        });

    } catch (error) {
        console.error('Error retrieving video IDs by channel ID:', error);
        return res.status(500).json({ message: 'Error retrieving video IDs by channel ID', error: error.message });
    }
}

export async function updateLatestVideoInfo() {
    // 모든 채널의 최신 비디오 정보를 저장할 Map 객체 생성
    const videoInfoMap = new Map();

    const videoPromises = channelIdList.map(async (channelId) => {
        try {
            // 채널의 업로드된 영상 플레이리스트 ID 및 채널 이름 가져오기
            const channelResponse = await youtube.channels.list({
                part: 'contentDetails,snippet', // snippet 추가
                id: channelId,
            });

            const channelDetails = channelResponse.data.items[0];
            if (!channelDetails) {
                console.warn(`No channel details found for channel ID: ${channelId}`);
                return;
            }

            const playlistId = channelDetails.contentDetails.relatedPlaylists.uploads;
            const channelName = channelDetails.snippet.title; // 채널 이름 가져오기

            // 해당 플레이리스트에서 최신 영상 가져오기
            const latestVideoResponse = await youtube.playlistItems.list({
                part: 'snippet',
                playlistId: playlistId,
                maxResults: 1 // 가장 최신 1개의 영상만 가져오기
            });

            if (latestVideoResponse.data.items.length === 0) {
                console.warn(`No videos found for channel ID: ${channelId}`);
                return;
            }

            // 최신 비디오 정보 추출
            const latestVideo = latestVideoResponse.data.items[0].snippet;
            const videoId = latestVideoResponse.data.items[0].snippet.resourceId.videoId;
            const videoData = {
                channelName: channelName,
                title: latestVideo.title,
                thumbnail: latestVideo.thumbnails.medium.url,
                publishedAt: latestVideo.publishedAt,
                videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
            };

            // Map 객체에 채널 ID를 키로 사용하여 데이터 추가
            videoInfoMap.set(channelId, videoData);

            //console.log(`Latest video for channel ${channelId} processed successfully:`, videoData);
        } catch (err) {
            console.error(`Error processing channel ${channelId}:`, err);
        }
    });

    // 모든 비디오 정보 가져오기 작업이 완료될 때까지 대기
    await Promise.all(videoPromises);

    // Map 객체를 일반 객체로 변환하여 Firestore에 저장
    const videoInfoObject = Object.fromEntries(videoInfoMap);

    try {
        // Firestore에 데이터 저장 (일괄 저장)
        await db.collection('youtubevideos').doc('0_latest').set(videoInfoObject);

        console.log("All channel video information saved successfully.");
        // 성공적으로 저장되었을 때 응답
        return;

    } catch (err) {
        console.error("Error saving video information to Firestore:", err);
        return;
    }
}

export async function getLatestVideoInfo(req, res) {
    try {
        // Firestore에서 최신 비디오 정보 가져오기
        const doc = await db.collection('youtubevideos').doc('0_latest').get();

        // 문서가 존재하는지 확인
        if (!doc.exists) {
            return res.status(404).json({ message: 'No latest video data found.' });
        }

        // 문서 데이터 가져오기
        const videoData = doc.data();

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