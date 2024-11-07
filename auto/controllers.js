import { google } from 'googleapis';
import { db } from '../firebase_admin.js';
import { getDate, getTime, getDayName, newGetTime } from '../utils/date.js';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });
const apiKey = process.env.YOUTUBE_API_KEY;
const channelIdList = process.env.CHANNEL_ID_LIST.split(',');

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

        await db.collection('youtubechannels').doc('0').set(channelDataObject);

        // 응답 전송
        console.log('Channel information has been saved successfully.');
        return;

    } catch (error) {
        console.error('Error fetching channel information:', error);
        return;
    }
}

// 유틸 함수: Firestore에 데이터를 저장
async function saveToFirestore(path, data, options = { merge: true }) {
    return db.doc(path).set(data, options);
}

// 메인 업데이트 함수
export async function updateLiveData() {
    try {
        const [lastDoc, chartDataDoc, doc] = await Promise.all([
            db.collection('youtubelivedata').doc('0').get(),
            db.collection('youtubelivedata').doc('0_chart').get(),
            db.collection('youtubevideos').doc('0').get()
        ]);

        if (!doc.exists) {
            console.error('No data found in Firestore for document "0"');
            return;
        }

        const countMapData = lastDoc.data() || {};
        const chartDataList = chartDataDoc.data() || {};
        const channelDataObject = doc.data();

        const videoIdsByChannel = {};
        Object.keys(channelDataObject).forEach(channelId => {
            const videoIds = channelDataObject[channelId].map(video => video.videoid);
            videoIdsByChannel[channelId] = videoIds;
        });

        const promises = [];
        const countMap = {};
        const subCountMap = {};

        // 각 채널의 데이터를 병렬로 처리
        for (let i = 0; i < channelIdList.length; i += 2) {
            const channelItem = channelIdList[i];
            const subChannelItem = channelIdList[i + 1];

            promises.push((async () => {
                const videoIds = videoIdsByChannel[channelItem]?.join(',');
                const subVideoIds = videoIdsByChannel[subChannelItem]?.join(',');
                if (!videoIds || !subVideoIds) return;

                const [response, subResponse] = await Promise.all([
                    youtube.videos.list({ id: videoIds, part: 'statistics' }),
                    youtube.videos.list({ id: subVideoIds, part: 'statistics' })
                ]);

                const existingData = countMapData[channelItem] || {};
                const subExistingData = countMapData[subChannelItem] || {};

                countMap[channelItem] = initializeCountData(existingData);
                subCountMap[subChannelItem] = initializeCountData(subExistingData);

                aggregateStatistics(response.data.items, countMap[channelItem]);
                aggregateStatistics(subResponse.data.items, subCountMap[subChannelItem]);

                updateCountDifferences(countMap[channelItem], subCountMap[subChannelItem]);

                updatePriceDifferences(countMap[channelItem]);

                updateChartDataList(chartDataList, channelItem, countMap[channelItem]);

            })().catch(error => console.error(`Error fetching data for channel ${channelItem}:`, error)));
        }

        await Promise.all(promises);

        await saveToFirestore('youtubelivedata/0_chart', chartDataList);
        //await saveToFirestore(`youtubelivedata/history_chart/${getDate()}/${getTime()}`, chartDataList);
        await saveToFirestore('youtubelivedata/0', countMap);
        await saveToFirestore('youtubelivedata/0_sub', subCountMap);
        await saveToFirestore(`youtubelivedata/history/${getDayName()}/${newGetTime()}`, countMap);
        await saveToFirestore(`youtubelivedata/history_sub/${getDayName()}/${newGetTime()}`, subCountMap);

        console.log('All video IDs grouped by channel ID retrieved successfully.');
    } catch (error) {
        console.error('Error retrieving video IDs by channel ID:', error);
    }
}

// 유틸 함수: 초기 countMap 데이터 설정
function initializeCountData(existingData) {
    return {
        totalViewCount: 0,
        totalLikeCount: 0,
        totalCommentCount: 0,
        lastTotalViewCount: existingData.totalViewCount || 0,
        lastTotalLikeCount: existingData.totalLikeCount || 0,
        lastTotalCommentCount: existingData.totalCommentCount || 0,
        lastDifferenceViewCount: existingData.differenceViewCount || 0,
        lastDifferenceLikeCount: existingData.differenceLikeCount || 0,
        lastDifferenceCommentCount: existingData.differenceCommentCount || 0,
        lastViewCountPrice: existingData.viewCountPrice || 10000,
        lastLikeCountPrice: existingData.likeCountPrice || 10000,
        lastCommentCountPrice: existingData.commentCountPrice || 10000,
        viewCountPrice: 0,
        likeCountPrice: 0,
        commentCountPrice: 0,
        updateTime: getTime(),
    };
}

// 유틸 함수: 통계 합계 계산
function aggregateStatistics(items, countData) {
    items.forEach(item => {
        const statistics = item.statistics;
        countData.totalViewCount += parseInt(statistics.viewCount, 10) || 0;
        countData.totalLikeCount += parseInt(statistics.likeCount, 10) || 0;
        countData.totalCommentCount += parseInt(statistics.commentCount, 10) || 0;
    });
}

// 유틸 함수: 차이 계산
function updateCountDifferences(countData, subCountData) {
    countData.differenceViewCount = countData.totalViewCount - subCountData.totalViewCount;
    countData.differenceLikeCount = countData.totalLikeCount - subCountData.totalLikeCount;
    countData.differenceCommentCount = countData.totalCommentCount - subCountData.totalCommentCount;
}

// 유틸 함수: 가격 업데이트
function updatePriceDifferences(countData) {
    countData.viewCountPrice += countData.differenceViewCount - countData.lastDifferenceViewCount;
    countData.likeCountPrice += countData.differenceLikeCount - countData.lastDifferenceLikeCount;
    countData.commentCountPrice += countData.differenceCommentCount - countData.lastDifferenceCommentCount;
}

// 유틸 함수: 차트 데이터 업데이트
function updateChartDataList(chartDataList, channelItem, countData) {
    if (!chartDataList[channelItem]) {
        chartDataList[channelItem] = { viewCount: [], likeCount: [], commentCount: [] };
    }

    if (chartDataList[channelItem].viewCount.length > 144) {
        chartDataList[channelItem].viewCount.shift();
        chartDataList[channelItem].likeCount.shift();
        chartDataList[channelItem].commentCount.shift();
    }

    chartDataList[channelItem].viewCount.push(countData.viewCountPrice);
    chartDataList[channelItem].likeCount.push(countData.likeCountPrice);
    chartDataList[channelItem].commentCount.push(countData.commentCountPrice);
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

                    // 각 채널의 history에 비디오 데이터 저장
                    const historyRef = db.collection('youtubevideos').doc(channelId).collection('history').doc(getDate());
                    batch.set(historyRef, { videos: videoDataList });

                    // 메인 데이터 위치인 'youtubevideos/0' 문서에 채널 데이터 업데이트
                    const combinRef = db.collection('youtubevideos').doc('0');
                    const combinDoc = await combinRef.get();

                    // 문서가 없으면 초기 데이터를 설정
                    if (!combinDoc.exists) {
                        await combinRef.set({});
                    }
                    batch.set(combinRef, { [channelId]: videoDataList }, { merge: true });

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

// 랭킹 데이터 갱신
export async function setRankData() {
    try {
        const usersSnapshot = await db.collection('users')
            .orderBy('totalmoney', 'desc')
            .orderBy('rank', 'asc')
            .orderBy('beforerank', 'asc')
            .orderBy('uid', 'asc')
            .limit(100)
            .get();

        const userList = [];
        let rank = 1;

        // Firestore 업데이트 작업을 병렬로 수행하기 위한 프로미스 배열
        const updatePromises = [];

        for (const doc of usersSnapshot.docs) {
            const data = doc.data();

            userList.push({
                rank: rank,
                name: data.name,
                totalmoney: data.totalmoney,
                beforerank: data.beforerank !== undefined ? data.beforerank : 0,
                choicechannel: data.choicechannel,
            });

            const userDocRef = db.collection('users').doc(data.uid);
            const updatePromise = userDocRef.update({
                rank: rank,
                beforerank: data.rank !== undefined ? data.rank : 0
            });
            updatePromises.push(updatePromise);

            rank++;
        }

        await Promise.all(updatePromises);

        const rankingDocRef = db.collection('rank').doc('0ranking');
        await rankingDocRef.set({ users: userList, 'updatedate': getDate() });

        const rankListDocRef = db.collection('rank').doc(getDate());
        await rankListDocRef.set({ users: userList });

        console.log('setRankData');
    } catch (error) {
        console.error('Error fetching top users:', error);
    }
}