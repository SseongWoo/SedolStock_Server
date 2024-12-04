import { admin, db } from '../firebase_admin.js';
import { getDate } from '../utils/date.js';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const channelIdList = process.env.CHANNEL_ID_LIST.split(',');

const stockType = ['view', 'comment', 'like'];

// 회원가입 1
export async function signUpUserData1(req, res) {
    const { uid, id, firstlogintime } = req.body;
    const money = 1000000;

    try {
        const userDocRef = db.collection('users').doc(uid);
        const totalmoneyDocRef = db.collection('users').doc(uid).collection('wallet').doc('totalmoneyhistory');

        // 문서를 지정된 데이터로 저장
        await userDocRef.set({
            uid,
            id,
            firstlogintime,
            money,
            'rank': 0,
            'totalmoney': money,
            'beforerank': 0,
        });

        await totalmoneyDocRef.set({
            totalmoneyhistory: [money],
            date: getDate(),
        });

        res.status(201).json({ message: 'User Data added successfully', uid: uid });
    } catch (error) {
        console.error('Error adding user:', error);
        res.status(500).json({ message: 'Failed to add user', error: error.message });
    }
}

// 회원가입 2
export async function signUpUserData2(req, res) {
    const { uid, name, choicechannel } = req.body;

    try {
        // 'users' 컬렉션의 문서 참조 생성
        const userDocRef = db.collection('users').doc(uid);

        // 사용자 데이터를 Firestore에 저장
        await userDocRef.update({
            name,
            choicechannel,
        });

        // 닉네임 중복을 방지하기 위해 닉네임 DB에 닉네임 저장
        await createName(uid, name);

        // 사용자의 지갑 데이터베이스를 생성
        await createUserWallet(uid);

        // 응답 반환
        res.status(201).json({ message: 'User Data updated successfully', uid: uid });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ message: 'Failed to update user', error: error.message });
    }
}


// 사용자 데이터 조회
export async function getUser(req, res) {
    const { uid } = req.params;

    try {
        // Firebase Admin SDK를 사용하여 'users' 컬렉션의 특정 문서 참조
        const userDocRef = admin.firestore().collection('users').doc(uid);
        const userDocSnap = await userDocRef.get();

        // 문서가 존재하는지 확인
        if (userDocSnap.exists) {
            res.status(200).json({ message: 'User retrieved successfully', data: userDocSnap.data() });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Error getting user:', error);
        res.status(500).json({ message: 'Failed to get user', error: error.message });
    }
}

// 중복 이름 조회
export async function searchName(req, res) {
    const { name } = req.params;

    try {
        // 'names' 컬렉션의 특정 이름 문서 참조
        const userDocRef = db.collection('names').doc(name);

        // 문서 가져오기
        const userDocSnap = await userDocRef.get();

        // 문서가 존재하는지 확인
        if (userDocSnap.exists) {
            res.status(200).json({ message: 'User retrieved successfully', data: userDocSnap.data() });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Error getting user by name:', error);
        res.status(500).json({ message: 'Failed to get user', error: error.message });
    }
}
// // 사용자 삭제
// export async function deleteUser(req, res) {
//     const { id } = req.params;

//     try {
//         // 'users' 컬렉션에서 해당 ID를 가진 문서 참조
//         const userDocRef = db.collection('users').doc(id);

//         // 문서 삭제
//         await userDocRef.delete();

//         // 성공적으로 삭제된 경우 응답 반환
//         res.status(200).json({ message: `User with ID ${id} deleted successfully` });
//     } catch (error) {
//         console.error('Error deleting user:', error);
//         res.status(500).json({ message: 'Failed to delete user', error: error.message });
//     }
// }

// 이름 변경 기능 함수
export async function updateName(req, res) {
    const { uid, name, newname } = req.body;

    try {
        const userDocRef = db.collection('users').doc(uid);
        const nameDocRef = db.collection('names').doc(name);

        // Firebase Admin SDK를 사용하여 작업 수행
        // 파이어베이스에 문서의 이름을 변경하는 기능이 없기 때문에 삭제하고 새로 생성
        await db.runTransaction(async (transaction) => {
            // 이름 문서 삭제
            transaction.delete(nameDocRef);

            // 사용자 문서 업데이트
            transaction.update(userDocRef, { "name": newname });

            // 새로운 이름 문서 생성
            const newNameDocRef = db.collection('names').doc(newname);
            transaction.set(newNameDocRef, { uid, 'name': newname }); // 새로운 이름에 대한 문서 생성
        });

        res.status(200).json({ message: `User with name ${newname} updated successfully` });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ message: 'Failed to update user', error: error.message });
    }
}

export async function updateChoiceChannel(req, res) {
    const { uid, name } = req.body; // 입력에서 필요한 필드만 추출

    try {
        const userDocRef = db.collection('users').doc(uid);

        // Firebase Admin SDK를 사용하여 작업 수행
        // 사용자 문서에 'choicechannel' 필드를 업데이트
        await userDocRef.update({ 'choicechannel': name });

        res.status(200).json({ message: 'User choice channel updated successfully' });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ message: 'Failed to update user', error: error.message });
    }
}

// name 컬랙션에 생성할 이름을 문서로 만드는 함수
async function createName(uid, name) {
    try {
        // Firestore의 'names' 컬렉션의 특정 문서를 참조
        const nameDocRef = db.collection('names').doc(name);

        // 닉네임 DB에 닉네임 저장
        await nameDocRef.set({
            name,
            uid,
        });

        console.log("Name created successfully");
    } catch (error) {
        console.error("Error creating name:", error);
    }
}

// 사용자 데이터 요청
export async function getUserData(req, res) {
    const { uid } = req.params;

    try {
        // Firebase Admin SDK를 사용하여 'users' 컬렉션의 특정 문서 참조
        const userDocRef = admin.firestore().collection('users').doc(uid);
        const userDocSnap = await userDocRef.get();

        // 문서가 존재하는지 확인
        if (userDocSnap.exists) {
            res.status(200).json({ message: 'User retrieved successfully', data: userDocSnap.data() });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Error getting user:', error);
        res.status(500).json({ message: 'Failed to get document', error: error.message });
    }
}

// // 사용자 프로필 설정
// export async function setUserProfile(req, res) {
//     try {
//         const { uid } = req.params;

//         // 파일이 없을 때 오류 처리
//         if (!req.file) {
//             return res.status(400).json({ message: 'Photo file is required.' });
//         }
//         if (!uid) {
//             return res.status(400).json({ message: 'UID is required.' });
//         }

//         // 고유한 파일 이름 생성 및 저장
//         const fileName = `profile/${uid}`;
//         const blob = bucket.file(fileName);
//         const blobStream = blob.createWriteStream({
//             metadata: {
//                 contentType: req.file.mimetype,
//             }
//         });

//         blobStream.on('error', (error) => {
//             console.error('Error uploading file to Firebase Storage:', error);
//             return res.status(500).json({ message: 'Failed to upload photo.', error: error.message });
//         });

//         blobStream.on('finish', async () => {
//             try {
//                 const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;

//                 // Firestore에 프로필 URL 저장
//                 const userDocRef = db.collection('users').doc(uid);
//                 await userDocRef.set({ profile: publicUrl }, { merge: true });

//                 return res.status(200).json({ message: 'Photo uploaded successfully.', photoUrl: publicUrl });
//             } catch (error) {
//                 console.error('Error updating Firestore with the profile URL:', error);
//                 return res.status(500).json({ message: 'Failed to save profile URL to Firestore.', error: error.message });
//             }
//         });

//         // 파일 업로드 시작
//         blobStream.end(req.file.buffer);

//     } catch (error) {
//         console.error('Error processing file upload:', error);
//         return res.status(500).json({ message: 'An error occurred while processing the photo upload.', error: error.message });
//     }
// }

// name 컬랙션에 생성할 이름을 문서로 만드는 함수
async function createUserWallet(uid) {
    try {
        // Firestore의 'wallet' 컬렉션에서 특정 사용자 문서를 참조
        const walletDocRef = db.collection('users').doc(uid).collection('wallet').doc('stock');

        // 각 채널 ID와 stockType을 조합하여 키를 생성하고 데이터를 설정
        let walletData = {};
        for (let i = 0; i < channelIdList.length; i += 2) {
            const channelId = channelIdList[i];
            stockType.forEach(type => {
                const key = `${channelId}_${type}`;
                walletData[key] = {
                    stockName: `${channelId}_${type}`, // 기본값 설정
                    stockCount: 0, // 기본값 설정
                    stockPrice: 0  // 기본값 설정
                };
            });
        }

        // Firestore에 데이터를 저장
        await walletDocRef.set(walletData);

        console.log("User wallet created successfully with stock types");
    } catch (error) {
        console.error("Error creating user wallet with stock types:", error);
    }
}

export async function getUserWallet(req, res) {
    const { uid } = req.params;

    try {
        // Firebase Admin SDK를 사용하여 'users' 컬렉션의 특정 문서 참조
        const userDocRef = admin.firestore().collection('users').doc(uid).collection('wallet').doc('stock');
        const userMoneyHisotryDocRef = admin.firestore().collection('users').doc(uid).collection('wallet').doc('totalmoneyhistory');
        const userDocSnap = await userDocRef.get();
        const userMoneyHistoryDocSnap = await userMoneyHisotryDocRef.get();

        // 문서가 존재하는지 확인
        if (userDocSnap.exists && userMoneyHistoryDocSnap.exists) {
            res.status(200).json({ message: 'User retrieved successfully', data: userDocSnap.data(), moneyhistory: userMoneyHistoryDocSnap.data() });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Error getting user:', error);
        res.status(500).json({ message: 'Failed to get document', error: error.message });
    }
}




export async function updateUserTotalMoney(req, res) {
    const { uid } = req.params;
    const { totalmoney } = req.body;

    // 유효성 검사 추가
    if (!uid) {
        return res.status(400).json({ message: 'User ID is required' });
    }

    if (typeof totalmoney !== 'number' || isNaN(totalmoney)) {
        return res.status(400).json({ message: 'Invalid totalmoney value' });
    }

    try {
        // 'users' 컬렉션의 문서 참조 생성
        const userDocRef = db.collection('users').doc(uid);

        // 사용자 데이터를 Firestore에 저장
        await userDocRef.update({ totalmoney });

        await updateUserTotalMoneyHistory(uid, totalmoney);

        // 응답 반환
        res.status(200).json({ message: 'User Data updated successfully', uid });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ message: 'Failed to update user', error: error.message });
    }
}

async function updateUserTotalMoneyHistory(uid, totalmoney) {
    try {
        // Firestore 참조 생성
        const totalmoneyDocRef = db.collection('users').doc(uid).collection('wallet').doc('totalmoneyhistory');
        const totalmoneylogDocRef = db.collection('users').doc(uid).collection('wallet').doc(getDate());

        // 현재 날짜 가져오기
        const currentDate = getDate(); // 날짜를 YYYY-MM-DD 형식으로 반환
        const currentMoney = parseInt(totalmoney, 10); // totalmoney를 정수형으로 변환

        // totalMoneyHistory 문서 가져오기
        const totalmoneyDocSnap = await totalmoneyDocRef.get();

        if (totalmoneyDocSnap.exists) {
            // 기존 데이터 가져오기
            let historyData = totalmoneyDocSnap.data().totalmoneyhistory || [];
            let dateData = totalmoneyDocSnap.data().date || '2024-00-00';

            // 기존 날짜가 현재 날짜와 같은지 확인
            if (dateData === currentDate) {
                // 날짜가 같다면 최신 아이템을 삭제하고 새로운 totalmoney 삽입
                historyData.pop();
            }

            // 새로운 항목 추가
            historyData.push(currentMoney);
            dateData = currentDate;

            // Firestore에 업데이트
            await totalmoneyDocRef.update({
                totalmoneyhistory: historyData,
                date: dateData
            });
        } else {
            // 문서가 존재하지 않는 경우 새로 생성하여 삽입
            await totalmoneyDocRef.set({
                totalmoneyhistory: [currentMoney],
                date: currentDate
            });
        }

        // totalmoneylogDocRef의 데이터 업데이트
        await totalmoneylogDocRef.set({ totalmoney: currentMoney }, { merge: true });
    } catch (error) {
        console.error("Error updating user total money:", error);
    }
}

export async function restartUserData(req, res) {
    const { uid } = req.body;
    const initialMoney = 1000000; // 초기 자산

    try {
        const userDocRef = db.collection('users').doc(uid);
        const totalmoneyDocRef = db.collection('users').doc(uid).collection('wallet').doc('totalmoneyhistory');

        // 거래 데이터 삭제
        await db.collection('users').doc(uid).collection('trade').doc('0').delete();
        await db.collection('users').doc(uid).collection('trade').doc('0_last').delete();

        // 사용자 문서 업데이트
        await userDocRef.update({
            money: initialMoney,
            'rank': 0,
            'totalmoney': initialMoney,
            'beforerank': 0,
        });

        // totalmoneyhistory에 초기 데이터 삽입
        await totalmoneyDocRef.set({
            totalmoneyhistory: [initialMoney],
            date: getDate(),
        });

        // 사용자 지갑 생성
        await createUserWallet(uid);

        // 성공 응답
        res.status(201).json({ message: 'User data reset successfully', uid: uid });
    } catch (error) {
        console.error('Error resetting user data:', error);
        res.status(500).json({ message: 'Failed to reset user data', error: error.message });
    }
}