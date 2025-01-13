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
import { getDate, getTime, getDayName, newGetTime } from '../utils/date.js';
import { controllVersionFile, updateJson, getJson } from '../utils/file.js'
import { Config } from '../config.js';

const apiKey = process.env.YOUTUBE_API_KEY;
const channelIdList = process.env.CHANNEL_ID_LIST ? process.env.CHANNEL_ID_LIST.split(',') : [];
const packageName = process.env.APP_PACKAGE_NAME;
const packageAPIKEY = path.resolve(__dirname, process.env.APP_API_KEY);

const delistingTime = Config.PERCENT_CONFIG.delistingTime;       // 상장폐지 기간
const percentage = Config.PERCENT_CONFIG.percentage;     // 조회수 배율
const firstPrice = Config.PERCENT_CONFIG.firstPrice;
const lowerLimit = Config.PERCENT_CONFIG.lowerLimit;


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

// 유틸 함수: Firestore에 데이터를 저장
async function saveToFirestore(path, data, options = { merge: true }) {
    return db.doc(path).set(data, options);
}

// 메인 업데이트 함수
export async function updateLiveData() {
    try {
        // JSON 파일 읽기
        const lastDoc = await getJson('../json/liveData.json');
        const chartDataDoc = await getJson('../json/liveChart.json');
        const videoListDoc = await getJson('../json/videoList.json');

        // 데이터 확인
        if (!videoListDoc || Object.keys(videoListDoc).length === 0) {
            console.error('No data found in JSON file for "videoList.json".');
            return;
        }

        // 데이터 초기화
        const countMapData = lastDoc || {};
        const chartDataList = chartDataDoc || {};

        // 비디오 ID 추출
        const videoIdsByChannel = {};

        for (const [channelId, videos] of Object.entries(videoListDoc)) {
            if (Array.isArray(videos)) {
                videoIdsByChannel[channelId] = videos
                    .map(video => {
                        const videoUrl = video?.videoUrl;
                        if (videoUrl) {
                            const videoIdMatch = videoUrl.match(/v=([^&]+)/);
                            return videoIdMatch ? videoIdMatch[1] : null;
                        }
                        return null;
                    })
                    .filter(id => id !== null); // null 값 제거
            } else {
                console.warn(`Invalid video data for channel ${channelId}`);
            }
        }

        const promises = [];
        const countMap = {};

        // 각 채널의 데이터를 병렬로 처리
        for (const channelItem of channelIdList) {
            promises.push((async () => {
                // 채널의 비디오 ID 가져오기
                const videoIds = videoIdsByChannel[channelItem]?.join(',');
                if (!videoIds) return;

                // YouTube API 호출
                const response = await youtube.videos.list({ id: videoIds, part: 'statistics' });

                // 기존 데이터 가져오기
                const existingData = countMapData[channelItem] || {};
                countMap[channelItem] = initializeCountData(existingData);

                // 통계 데이터 집계
                aggregateStatistics(response.data.items, countMap[channelItem]);

                // 차이 및 가격 업데이트
                updatePriceDifferences(countMap[channelItem], channelItem);
                updateChartDataList(chartDataList, channelItem, countMap[channelItem]);
            })().catch(error => console.error(`Error fetching data for channel ${channelItem}:`, error)));
        }

        // 모든 프로미스 대기
        await Promise.all(promises);

        // JSON 데이터 저장
        await updateJson('../json/liveData.json', countMap);
        await updateJson('../json/liveChart.json', chartDataList);

        // 파이어베이스에 저장
        await saveToFirestore('youtubelivedata/0_chart', JSON.parse(JSON.stringify(chartDataList)));
        await saveToFirestore('youtubelivedata/0', JSON.parse(JSON.stringify(countMap)));
        await saveToFirestore(`youtubelivedata/history/${getDayName()}/${newGetTime()}`, JSON.parse(JSON.stringify(countMap)));

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
        totalDiff: 0,
        lastTotalViewCount: existingData.totalViewCount || 0,
        lastTotalLikeCount: existingData.totalLikeCount || 0,
        lastPrice: existingData.price || firstPrice,
        lastDiff: existingData.price || 0,
        price: existingData.price || firstPrice,
        delisting: existingData.delisting || 0,
        updateTime: getTime(),
    };
}

// 유틸 함수: 통계 합계 계산
function aggregateStatistics(items, countData) {
    items.forEach(item => {
        const statistics = item.statistics;
        countData.totalViewCount += parseInt(statistics.viewCount, 10) || 0;
        countData.totalLikeCount += parseInt(statistics.likeCount, 10) || 0;
    });
}

// 유틸 함수: 가격 업데이트
function updatePriceDifferences(countData, channelItem) {
    const viewDiff = countData.totalViewCount - countData.lastTotalViewCount;
    const likeDiff = countData.totalLikeCount - countData.lastTotalLikeCount;
    const diffSum = viewDiff + likeDiff;

    let diffValue = (diffSum - countData.lastDiff) * percentage;

    console.log(diffValue + " = (" + diffSum + " - " + countData.lastDiff + ") * " + percentage);

    // 하한선 적용
    if (diffValue < -lowerLimit) {
        console.log(`diffValue: ${diffValue}, lowerLimit: ${lowerLimit}`);
        diffValue = -lowerLimit;
    }

    // 상장폐지 상태 처리
    if (countData.delisting > 0) {
        countData.price = 0;
        countData.delisting--;

        if (countData.delisting <= 0) {
            countData.price = firstPrice;
        }
    } else {
        // 가격 업데이트
        countData.price += diffValue;

        // 가격이 0 이하일 경우 상장폐지 처리
        if (countData.price <= 0) {
            countData.price = 0;
            countData.delisting = delistingTime;
            deleteDelistingStock(channelItem);
        }
    }
}

// 유틸 함수: 차트 데이터 업데이트
function updateChartDataList(chartDataList, channelItem, countData) {
    if (!chartDataList[channelItem]) {
        chartDataList[channelItem] = { price: [] };
    }
    if (chartDataList[channelItem].price.length > 50) {
        chartDataList[channelItem].price.shift();
    }
    chartDataList[channelItem].price.push(countData.price);
}

async function deleteDelistingStock(itemUid) {
    try {
        const itemName = itemUid;

        // 1. tradelist 경로의 문서 가져오기 (유저 UID가 문서 이름)
        const tradelistCollection = db.collection('youtubelivedata')
            .doc('tradelist')
            .collection(itemName);

        const tradelistSnapshot = await tradelistCollection.get();

        if (tradelistSnapshot.empty) {
            console.log(`No tradelist documents found for ${itemName}`);
            return;
        }

        const updatePromises = []; // 업데이트 및 메시지 저장 작업을 비동기로 처리

        const currentTime = getTime(); // 동일한 시간 값 사용

        // 2. 각 tradelist 문서 처리
        for (const doc of tradelistSnapshot.docs) {
            const userId = doc.id; // 문서 이름이 유저 UID
            const stockCount = doc.data().stockcount || 0; // 기본값 설정

            // wallet/stock 문서 참조
            const stockDocRef = db.collection('users').doc(userId).collection('wallet').doc('stock');
            const messageDocRef = db.collection('users').doc(userId).collection('message').doc(currentTime);

            // 업데이트할 필드 생성
            const updatedFields = {
                [itemName]: {
                    stockCount: 0,
                    stockPrice: 0,
                    stockName: itemName,
                },
            };

            const messageFields = {
                itemUid: itemName,
                stockCount: stockCount,
                time: currentTime,
            };

            // wallet 문서 업데이트 (존재하지 않으면 새로 생성)
            updatePromises.push(
                stockDocRef.set(updatedFields, { merge: true })
                    .then(() => console.log(`Updated stock document for user: ${userId}`))
                    .catch((error) => console.error(`Error updating stock for user ${userId}:`, error))
            );

            updatePromises.push(
                messageDocRef.set(messageFields)
                    .then(() => console.log(`Set message for user: ${userId}`))
                    .catch((error) => console.error(`Error setting message for user ${userId}:`, error))
            );
        }

        const deletePromises = tradelistSnapshot.docs.map((doc) =>
            doc.ref.delete().then(() => console.log(`Deleted document: ${doc.id}`))
        );

        // 3. 모든 업데이트 및 메시지 작업 완료 대기
        await Promise.all([...updatePromises, ...deletePromises].map(promise =>
            promise.catch(error => console.error('Promise failed:', error))
        ));

        console.log('All stock documents and messages updated successfully.');
    } catch (error) {
        console.error('Error updating stock fields and setting messages:', error);
    }
}


export async function updateVideoData() {
    try {
        // 전체 비디오 데이터를 저장할 객체
        const allVideoData = {};

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
                        videoUrl: `https://www.youtube.com/watch?v=${video.id}`,
                        title: video.snippet.title,
                        description: video.snippet.description,
                        thumbnail: video.snippet.thumbnails?.medium?.url || '',
                        publishedAt: video.snippet.publishedAt,
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

                    // allVideoData 객체에 채널 데이터를 추가
                    allVideoData[channelId] = videoDataList;
                }
            } catch (err) {
                console.error(`Error processing channel ${channelId}:`, err);
            }
        });

        // 모든 채널의 영상 데이터를 병렬로 처리
        await Promise.all(videoPromises);

        // JSON 파일에 최신 비디오 데이터 저장
        await updateJson('../json/videoList.json', allVideoData);

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
        await updateJson('../json/videoLatestList.json', videoInfoObject);
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

        await updateJson('../json/ranking.json', { users: userList, 'updatedate': getDate() });
        const rankingDocRef = db.collection('rank').doc('0ranking');
        await rankingDocRef.set({ users: userList, 'updatedate': getDate() });

        const rankListDocRef = db.collection('rank').doc(getDayName());
        await rankListDocRef.set({ users: userList, 'updatedate': getDate() });

        console.log(`setRankData : updateRank ${getDate()}`);
    } catch (error) {
        console.error('Error fetching top users:', error);
    }
}

export async function startDeleteUserData() {
    try {
        // 일주일 전의 날짜 계산
        const date = new Date();
        date.setDate(date.getDate() - 7);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const oneWeekAgoDate = `${year}-${month}-${day}`;

        // 일주일 전의 'delete' 컬렉션의 문서를 참조
        const userDocRef = db.collection('delete').doc(oneWeekAgoDate); // 일주일 전의 날짜 사용
        const userDocSnap = await userDocRef.get();

        // 문서가 존재하는지 확인
        if (!userDocSnap.exists) {
            console.log(`No delete data found for date: ${oneWeekAgoDate}`);
            return;
        }

        // 문서에서 'uidlist'와 'nameList' 필드 값 가져오기
        const uidList = userDocSnap.data().uidlist || [];
        const nameList = userDocSnap.data().namelist || [];

        // 'uidlist'가 있을 때만 처리
        if (uidList.length > 0) {
            // 각 uid에 대해 삭제 처리
            for (const uid of uidList) {
                try {

                    await deleteStockCount(uid);
                    // 'trade'와 'wallet' 컬렉션의 하위 문서 삭제
                    await deleteSubcollection(db.collection('users').doc(uid).collection('trade'));
                    await deleteSubcollection(db.collection('users').doc(uid).collection('wallet'));
                    await db.collection('users').doc(uid).delete();
                    console.log(`User document and subcollections for UID: ${uid} deleted successfully.`);
                } catch (error) {
                    console.error(`Error deleting user document and subcollections for UID: ${uid}:`, error);
                }
            }
        }

        // 'nameList'가 있을 때만 처리
        if (nameList.length > 0) {
            // 각 name에 대해 삭제 처리
            for (const name of nameList) {
                try {
                    const nameDocRef = db.collection('names').doc(name);
                    await nameDocRef.delete();
                    console.log(`Name document for name: ${name} deleted successfully.`);
                } catch (error) {
                    console.error(`Error deleting name document for name: ${name}:`, error);
                }
            }
        }

        // 'delete' 컬렉션의 해당 문서 삭제
        await userDocRef.delete();
        console.log(`Old delete data for date: ${oneWeekAgoDate} deleted successfully.`);
    } catch (error) {
        console.error(`Error deleting old user data for date ${oneWeekAgoDate}:`, error);
    }
}

async function deleteStockCount(uid) {
    try {
        // Firestore에서 stock 문서 가져오기
        const stockDocRef = db.collection('users').doc(uid).collection('wallet').doc('stock');
        const stockDoc = await stockDocRef.get();

        if (!stockDoc.exists) {
            console.log('Stock document does not exist for user:', uid);
            return; // 문서가 없으면 함수 종료
        }

        // 문서 데이터 가져오기
        const stockData = stockDoc.data();

        // stockCount > 0인 stockName 필터링
        const positiveStocks = Object.entries(stockData)
            .filter(([stockName, stockInfo]) => stockInfo.stockCount > 0) // stockCount 조건
            .map(([stockName]) => stockName); // stockName만 추출

        if (positiveStocks.length === 0) {
            console.log(`No stocks to delete for user: ${uid}`);
            return;
        }

        console.log(`Deleting stocks for user: ${uid}. Stocks:`, positiveStocks);

        // 병렬 삭제 작업 처리
        const deletePromises = positiveStocks.map((stockName) => {
            return db.collection('youtubelivedata')
                .doc('tradelist')
                .collection(stockName)
                .doc(uid)
                .delete()
                .then(() => console.log(`Deleted stock ${stockName} for user: ${uid}`))
                .catch((err) => console.error(`Failed to delete stock ${stockName} for user: ${uid}`, err));
        });

        // 모든 삭제 작업 완료 대기
        await Promise.all(deletePromises);

        console.log(`All stocks deleted for user: ${uid}`);
    } catch (error) {
        console.error('Error deleting stock data:', error);
    }
}

async function deleteSubcollection(collectionRef) {
    try {
        const snapshot = await collectionRef.get();

        if (snapshot.empty) {
            console.log(`No documents in subcollection: ${collectionRef.path}`);
            return;
        }

        // 각 문서를 삭제
        const deletePromises = snapshot.docs.map((doc) => doc.ref.delete());
        await Promise.all(deletePromises);

        console.log(`Subcollection ${collectionRef.path} deleted successfully.`);
    } catch (error) {
        console.error(`Error deleting subcollection ${collectionRef.path}:`, error);
    }
}


export async function getPlayStoreVersion() {
    try {
        // 1. Google Play 인증
        const auth = new google.auth.GoogleAuth({
            keyFile: packageAPIKEY,
            scopes: ['https://www.googleapis.com/auth/androidpublisher'],
        });

        const publisher = google.androidpublisher({ version: 'v3', auth });

        // 2. Edit 세션 생성
        const editResponse = await publisher.edits.insert({
            packageName: packageName,
        });
        const editId = editResponse.data.id;
        console.log(`Edit ID created: ${editId}`);

        // 3. 트랙 정보 가져오기 (production, beta, alpha 등)
        const trackResponse = await publisher.edits.tracks.get({
            packageName: packageName,
            editId: editId,
            track: 'alpha', // 'production' 트랙 버전 가져오기
        });

        // 4. 버전 정보 추출
        const releases = trackResponse.data.releases || [];
        if (releases.length > 0) {
            const versionCode = releases[0].versionCodes[0];
            const versionName = releases[0].name || 'No version name';

            console.log(`Latest Version Code: ${versionCode}`);
            console.log(`Version Name: ${versionName}`);
            await controllVersionFile('update', versionCode, versionName);
            return { versionCode, versionName };
        } else {
            console.log('No releases found in the specified track.');
            return null;
        }
    } catch (error) {
        console.error('Error fetching version info:', error.message);
        throw error;
    }
}