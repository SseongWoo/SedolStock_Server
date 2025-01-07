import { db } from '../firebase_admin.js';
import { controllVersionFile } from '../utils/file.js'

export async function checkRunningServer(req, res) {
    //const version = await checkVersion();
    const version = await controllVersionFile('get');
    res.status(200).send({ message: 'Server is running', version: version });
}

export async function getConstantsData(req, res) {
    //const version = await checkVersion();
    // const version = await controllVersionFile('get');
    // res.status(200).send({ message: 'Server is running', version: version });
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