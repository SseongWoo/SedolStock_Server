import { db, realtimeDB } from '../firebase_admin.js';
import { getDate, getDayName, getTime2 } from '../utils/date.js';
import { updateJson } from '../utils/file.js'

// 랭킹 데이터 갱신
export async function setRankData() {
    const fandomList = ['팬치', '이파리', '둘기', '똥강아지', '박쥐단', '주폭도', '세균단', '라니'];
    try {
        // Firestore batch 작업 시작
        const batch = db.batch();
        const rankings = {};
        const date = getDate();
        const time = getTime2();
        const dayName = getDayName();

        // 전체(전체) 상위 100명 가져오기
        const globalSnapshot = await realtimeDB.ref('ranking/전체')
            .orderByChild('totalmoney')
            .limitToLast(100)
            .once('value');

        rankings['전체'] = extractRankingData(globalSnapshot);

        // 각 팬덤별 상위 100명 가져오기
        for (const fandom of fandomList) {
            const fandomSnapshot = await realtimeDB.ref(`ranking/fandom/${fandom}`)
                .orderByChild('totalmoney')
                .limitToLast(100)
                .once('value');

            rankings[fandom] = extractRankingData(fandomSnapshot);
        }

        const rankingsData = {
            ranking: rankings,
            updatedate: time
        };

        // JSON 파일로 저장
        await updateJson('../json/rankings.json', rankingsData);

        // 전체 랭킹 저장
        const globalRef = db.collection('rank').doc('ranking_전체');
        batch.set(globalRef, { users: rankings['전체'], updatedate: date });

        // 전체 히스토리 저장
        const globalHistoryRef = db.collection('rank')
            .doc('history')
            .collection(dayName)
            .doc('ranking_전체');
        batch.set(globalHistoryRef, { users: rankings['전체'], updatedate: date });

        // 각 팬덤별 랭킹 저장
        for (const fandom of fandomList) {
            const fandomRef = db.collection('rank').doc(`ranking_${fandom}`);
            batch.set(fandomRef, { users: rankings[fandom], updatedate: date });

            // 팬덤별 히스토리 저장
            const fandomHistoryRef = db.collection('rank')
                .doc('history')
                .collection(dayName)
                .doc(`ranking_${fandom}`);
            batch.set(fandomHistoryRef, { users: rankings[fandom], updatedate: date });
        }

        // ✅ Firestore에 일괄 커밋
        await batch.commit();

        console.log('Rankings exported to rankings.json');
    } catch (error) {
        console.error('Error exporting rankings:', error);
    }
}

// 유틸리티 함수: 스냅샷 데이터를 배열로 변환
function extractRankingData(snapshot) {
    if (!snapshot.exists()) return []; // 데이터가 없을 경우 빈 배열 반환

    const rankingData = [];
    let rank = 1; // 순위는 1부터 시작

    snapshot.forEach(childSnapshot => {
        const data = childSnapshot.val();
        rankingData.push({
            uid: childSnapshot.key,
            rank: rank++, // 순위를 1씩 증가
            totalmoney: data.totalmoney,
            fandom: data.fandom,
            name: data.name,
        });
    });

    return rankingData.reverse(); // 내림차순 가져온 데이터의 순서를 다시 정렬
}

// 설정파일을 파이어베이스에서 가져옴
export async function getConfigConstant() {
    try {
        const constantDocRef = db.collection('config').doc('constant');
        const constantDocSnap = await constantDocRef.get();

        if (!constantDocSnap.exists) {
            console.error('No constant document found in Firestore.');
            return;
        }

        // 문서 데이터를 가져와 JSON 파일로 변환
        const constantData = constantDocSnap.data();

        await updateJson('../json/config_constant.json', constantData);

        console.log(`JSON file saved at config_constant.json`);
    } catch (error) {
        console.error('Error exporting config to JSON:', error);
    }
}