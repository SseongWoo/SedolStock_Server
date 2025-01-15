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
import { getDate, } from '../utils/date.js';
import { updateJson, getJson } from '../utils/file.js'

const apiKey = process.env.YOUTUBE_API_KEY;
const channelIdList = process.env.CHANNEL_ID_LIST ? process.env.CHANNEL_ID_LIST.split(',') : [];
const packageName = process.env.APP_PACKAGE_NAME;
const packageAPIKEY = path.resolve(__dirname, process.env.APP_API_KEY);

// YouTube API 인스턴스를 생성합니다.
const youtube = google.youtube({
    version: 'v3',
    auth: apiKey
});

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
                    await deleteSubcollection(db.collection('users').doc(uid).collection('message'));
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

export async function settingEvent() {
    try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD 형식
        const ongoingRef = db.collection('config').doc('event').collection('ongoing');      // 진행중인 이벤트
        const upcomingRef = db.collection('config').doc('event').collection('upcoming');     // 예정된 이벤트
        const completedRef = db.collection('config').doc('event').collection('completed');   // 완료된 이벤트

        // Firestore에서 모든 이벤트 데이터 가져오기
        const [ongoingSnapshot, upcomingSnapshot, completedSnapshot] = await Promise.all([
            ongoingRef.get(),
            upcomingRef.get(),
            completedRef.get()
        ]);

        // Firestore batch 작업 시작
        const batch = db.batch();

        // ✅ 예정된 이벤트를 진행 중 이벤트로 이동
        upcomingSnapshot.forEach(doc => {
            const eventData = doc.data();
            const { startDate } = eventData;

            // 오늘 날짜가 이벤트 시작일 이상일 경우 진행 중으로 이동
            if (startDate <= today) {
                const newRef = ongoingRef.doc(doc.id);
                batch.set(newRef, eventData);
                batch.delete(doc.ref); // 기존 문서 삭제
            }
        });

        // ✅ 진행 중 이벤트를 완료된 이벤트로 이동
        ongoingSnapshot.forEach(doc => {
            const eventData = doc.data();
            const { endDate } = eventData;

            // 오늘 날짜가 이벤트 종료일을 지난 경우 완료된 이벤트로 이동
            if (endDate < today) {
                const newRef = completedRef.doc(doc.id);
                batch.set(newRef, eventData);
                batch.delete(doc.ref); // 기존 문서 삭제
            }
        });

        // ✅ 완료된 이벤트 중, 종료일 기준으로 일주일 지난 이벤트 삭제
        completedSnapshot.forEach(doc => {
            const eventData = doc.data();
            const { endDate } = eventData;

            const endDateObj = new Date(endDate);
            const diffDays = (new Date(today) - endDateObj) / (1000 * 60 * 60 * 24); // 일 수 차이 계산

            // 종료일 기준 7일이 지난 경우 삭제
            if (diffDays > 7) {
                batch.delete(doc.ref);
                console.log(`Deleted completed event: ${doc.id}`);
            }
        });

        // ✅ Firestore에 일괄 커밋
        await batch.commit();

        // ✅ 이벤트 데이터를 JSON 파일로 저장
        const eventData = {
            date: today,
            ongoing: ongoingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
            upcoming: upcomingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
            completed: completedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        };

        await updateJson(path.resolve(__dirname, '../json/event.json'), eventData);

        console.log('Event data updated and saved to event.json');
    } catch (error) {
        console.error('Error fetching today’s events:', error);
    }
}