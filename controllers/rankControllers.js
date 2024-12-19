import { db } from '../firebase_admin.js';
import { getJson } from '../utils/file.js'

// 랭킹 데이터 가져오기
export async function getRankData(req, res) {
    try {
        // // Firestore에서 랭킹 문서 참조 가져오기
        // const rankDocRef = db.collection('rank').doc('0ranking'); // Admin SDK에서의 올바른 참조 방식
        // const rankDocSnap = await rankDocRef.get();

        // // 랭킹 데이터가 존재하는 경우 반환
        // if (rankDocSnap.exists) {
        //     res.status(200).json({
        //         message: 'getRankData retrieved successfully',
        //         data: rankDocSnap.data()
        //     });
        // } else {
        //     res.status(404).json({ message: 'getRankData not found' });
        // }
        const rankDocSnap = await getJson('../json/ranking.json');

        if (!rankDocSnap || Object.keys(rankDocSnap).length === 0) {
            return res.status(404).json({ message: 'getRankData not found' });
        }

        return res.status(200).json({
            message: 'getRankData retrieved successfully',
            data: rankDocSnap
        });


    } catch (error) {
        console.error('Error getting rank data:', error); // 오류 메시지 수정
        return res.status(500).json({ message: 'Failed to get rank data', error: error.message });
    }
}
