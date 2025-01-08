import { db } from '../firebase_admin.js';
import { controllVersionFile } from '../utils/file.js'
import { Config } from '../config.js';

export async function checkRunningServer(req, res) {
    //const version = await checkVersion();
    const version = await controllVersionFile('get');
    res.status(200).send({ message: 'Server is running', version: version });
}

export async function getConstantsData(req, res) {
    try {
        // Config 클래스의 데이터 가져오기
        const constantsData = {
            feeConfig: Config.FEE_CONFIG,
            percentConfig: Config.PERCENT_CONFIG,
        };
        res.status(200).send({ message: 'Server is running', data: constantsData });
    } catch (error) {
        console.error("Error getConstantsData:", error);
        // 에러 발생 시 500 응답
        res.status(500).json({ message: "Failed to fetch constants data", error: error.message });
    }
}


// async function checkVersion() {
//     try {
//         // Firestore에서 문서 가져오기
//         const versionDoc = await db.collection('config').doc('app_version').get();

//         // 문서 존재 여부 확인
//         if (versionDoc.exists) {
//             // 필드 데이터 출력
//             const versionData = versionDoc.data();
//             //console.log('Version Data:', versionData);
//             return versionData;
//         } else {
//             //console.log('Document does not exist.');
//             return {
//                 latest_version:
//                     "0.0.0",
//                 latest_build: "0",
//                 min_version:
//                     "0.0.0",
//                 min_build: "0",
//             }
//         }
//     } catch (e) {
//         //console.error('Error fetching version:', e);
//         return {
//             latest_version:
//                 "0.0.0",
//             latest_build: "0",
//             min_version:
//                 "0.0.0",
//             min_build: "0",
//         }
//     }
// }