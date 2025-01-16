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
import { db, realtimeDB } from '../firebase_admin.js';
import { getDate, getTime, getDayName, newGetTime, getTime2 } from '../utils/date.js';
import { controllVersionFile, updateJson, getJson } from '../utils/file.js'

const apiKey = process.env.YOUTUBE_API_KEY;
const channelIdList = process.env.CHANNEL_ID_LIST ? process.env.CHANNEL_ID_LIST.split(',') : [];
const packageName = process.env.APP_PACKAGE_NAME;
const packageAPIKEY = path.resolve(__dirname, process.env.APP_API_KEY);

// YouTube API 인스턴스를 생성합니다.
const youtube = google.youtube({
    version: 'v3',
    auth: apiKey
});


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
        const configDoc = await getJson('../json/config_constant.json');
        const eventDoc = await getJson('../json/event.json');

        console.log(configDoc);

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
                // 채널의 이벤트 유무 가져오기
                let multiplier = 1;
                if (eventDoc && eventDoc.ongoing) {
                    for (const event of eventDoc.ongoing) {
                        // 현재 채널이 이벤트 채널 목록에 포함되어 있는지 확인
                        if (event.channel.includes(channelItem)) {
                            if (multiplier < event.multiplier) {
                                multiplier = event.multiplier;
                                console.log(`Applying event: ${event.title} with multiplier ${event.multiplier}`);
                            }
                        }
                    }
                }

                // 채널의 비디오 ID 가져오기
                const videoIds = videoIdsByChannel[channelItem]?.join(',');
                if (!videoIds) return;

                // YouTube API 호출
                const response = await youtube.videos.list({ id: videoIds, part: 'statistics' });

                // 기존 데이터 가져오기
                const existingData = countMapData[channelItem] || {};
                countMap[channelItem] = initializeCountData(existingData, configDoc.firstprice);

                // 통계 데이터 집계
                aggregateStatistics(response.data.items, countMap[channelItem]);

                // 차이 및 가격 업데이트
                updatePriceDifferences(countMap[channelItem], channelItem, configDoc, multiplier);
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
function initializeCountData(existingData, firstPrice) {
    return {
        totalViewCount: 0,
        totalLikeCount: 0,
        totalDiff: 0,
        lastTotalViewCount: existingData.totalViewCount || 0,
        lastTotalLikeCount: existingData.totalLikeCount || 0,
        lastPrice: existingData.price || 0,
        lastDiff: existingData.totalDiff || 0,
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
function updatePriceDifferences(countData, channelItem, configDoc, multiplier) {
    const viewDiff = countData.totalViewCount - countData.lastTotalViewCount;
    const likeDiff = countData.totalLikeCount - countData.lastTotalLikeCount;
    const diffSum = viewDiff + likeDiff;
    const lowerLimit = countData.lastPrice !== 0
        ? Math.max(Math.round(countData.lastPrice * configDoc.limitpersentlower / 100), 100)
        : 0;

    const upperLimit = countData.lastPrice !== 0
        ? Math.max(Math.round(countData.lastPrice * configDoc.limitpersentupper / 100), 100)
        : 0;

    countData.totalDiff = diffSum;

    let diffValue = (diffSum - countData.lastDiff) * configDoc.pricepercentage;

    // 하한선 적용
    if (lowerLimit != 0 && diffValue < -lowerLimit) {
        console.log(`diffValue: ${diffValue}, lowerLimit: ${lowerLimit}`);
        diffValue = -lowerLimit;
    }
    //상한선 적용
    else if (upperLimit != 0 && diffValue > upperLimit) {
        console.log(`diffValue: ${diffValue}, upperLimit: ${upperLimit}`);
        diffValue = upperLimit;
    }

    // 상장폐지 상태 처리
    if (countData.delisting > 0) {
        countData.price = 0;
        countData.delisting--;

        if (countData.delisting <= 0) {
            countData.price = countData.firstprice;
        }
    } else {
        if (multiplier > 1 && diffValue > 0) {
            diffValue = Math.round(diffValue * multiplier);
        }

        // 가격 업데이트
        countData.price += diffValue;

        // 가격이 0 이하일 경우 상장폐지 처리
        if (countData.price <= 0) {
            countData.price = 0;
            countData.delisting = countData.delistingtime;
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