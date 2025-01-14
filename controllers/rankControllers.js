import { db } from '../firebase_admin.js';
import { getJson } from '../utils/file.js'

// 랭킹 데이터 가져오기
export async function getRankData(req, res) {
    try {
        const rankDocSnap = await getJson('../json/rankings.json');

        if (!rankDocSnap || Object.keys(rankDocSnap).length === 0) {
            return res.status(404).json({ message: 'getRankData not found' });
        }

        return res.status(200).json({
            message: 'getRankData retrieved successfully',
            updatedate: rankDocSnap.updatedate,
            ranking: rankDocSnap.ranking
        });


    } catch (error) {
        console.error('Error getting rank data:', error); // 오류 메시지 수정
        return res.status(500).json({ message: 'Failed to get rank data', error: error.message });
    }
}
