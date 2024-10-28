import { collection, addDoc, getDoc, doc, deleteDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase_admin.js';
import { getDate } from '../utils/date.js';

// 랭킹 데이터 갱신
export async function setRankData() {
    try {
        // Firestore에서 'users' 컬렉션을 'totalmoney' 내림차순으로 정렬하고 최대 100개 제한
        const usersSnapshot = await db.collection('users')
            .orderBy('totalmoney', 'desc')
            .orderBy('rank', 'asc')
            .orderBy('beforerank', 'asc')
            .orderBy('uid', 'asc')
            .limit(100)
            .get();

        // 사용자 데이터를 배열로 정리
        const userList = [];
        let rank = 1; // 랭킹 시작: 1등부터

        for (const doc of usersSnapshot.docs) {
            const data = doc.data();

            userList.push({
                rank: rank,  // 현재 루프의 순서를 rank로 추가
                name: data.name,
                totalmoney: data.totalmoney,
                beforerank: data.beforerank !== undefined ? data.beforerank : 0,
                choicechannel: data.choicechannel,
            });

            const userDocRef = db.collection('users').doc(data.uid);

            // Firestore에 사용자 랭킹 정보 업데이트 (기존 데이터 덮어쓰지 않고 업데이트)
            await userDocRef.update({
                rank: rank,
                beforerank: data.rank !== undefined ? data.rank : 0
            });

            rank++; // 다음 순위를 위해 rank 증가
        }

        // Firestore에 전체 랭킹 데이터를 저장
        const rankingDocRef = db.collection('rank').doc('0ranking');
        await rankingDocRef.set({ users: userList, 'updatedate': getDate() });

        const rankListDocRef = db.collection('rank').doc(getDate());
        await rankListDocRef.set({ users: userList });

        console.log('setRankData');
    } catch (error) {
        console.error('Error fetching top users:', error);
    }
}

// 랭킹 데이터 가져오기
export async function getRankData(req, res) {
    try {
        // Firestore에서 랭킹 문서 참조 가져오기
        const rankDocRef = db.collection('rank').doc('0ranking'); // Admin SDK에서의 올바른 참조 방식
        const rankDocSnap = await rankDocRef.get();

        // 랭킹 데이터가 존재하는 경우 반환
        if (rankDocSnap.exists) {
            res.status(200).json({
                message: 'getRankData retrieved successfully',
                data: rankDocSnap.data()
            });
        } else {
            res.status(404).json({ message: 'getRankData not found' });
        }
    } catch (error) {
        console.error('Error getting rank data:', error); // 오류 메시지 수정
        res.status(500).json({ message: 'Failed to get rank data', error: error.message });
    }
}
