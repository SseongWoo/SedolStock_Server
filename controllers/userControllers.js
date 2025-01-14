import { admin, db, realtimeDB } from '../firebase_admin.js';
import { getDate } from '../utils/date.js';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const channelIdList = process.env.CHANNEL_ID_LIST.split(',');

const stockType = ['view', 'comment', 'like'];

export async function signUpUserData(req, res) {
    const { uid, id, firstlogintime, name, choicechannel } = req.body;
    const money = 1000000;

    try {
        const userDocRef = db.collection('users').doc(uid);
        const totalmoneyDocRef = db.collection('users').doc(uid).collection('wallet').doc('totalmoneyhistory');
        const date = getDate();

        // 문서를 지정된 데이터로 저장
        await userDocRef.set({
            uid,
            id,
            firstlogintime,
            money,
            'rank': 0,
            'totalmoney': money,
            'beforerank': 0,
            name,
            choicechannel,
        });

        await totalmoneyDocRef.set({
            totalmoneyhistory: [{ money: money, date: date }],
            date: date,
        });

        // 닉네임 중복을 방지하기 위해 닉네임 DB에 닉네임 저장
        await createName(uid, name);

        // 사용자의 지갑 데이터베이스를 생성
        //await createUserWallet(uid);

        res.status(201).json({ message: 'User Data added successfully', uid: uid });
    } catch (error) {
        console.error('Error adding user:', error);
        res.status(500).json({ message: 'Failed to add user', error: error.message });
    }
}

// 회원가입 1
export async function signUpUserData1(req, res) {
    const { uid, id, firstlogintime } = req.body;
    const money = 1000000;

    try {
        const userDocRef = db.collection('users').doc(uid);
        const totalmoneyDocRef = db.collection('users').doc(uid).collection('wallet').doc('totalmoneyhistory');
        const date = getDate();

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
            totalmoneyhistory: [{ money, date }],
            date: date,
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
        //await createUserWallet(uid);

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
// // // 사용자 삭제
export async function deleteUser(req, res) {
    const { uid } = req.params;

    try {
        await deleteStockCount(uid);
        // 'trade'와 'wallet' 컬렉션의 하위 문서 삭제
        await deleteSubcollection(db.collection('users').doc(uid).collection('trade'));
        await deleteSubcollection(db.collection('users').doc(uid).collection('wallet'));
        await db.collection('users').doc(uid).delete();

        // 성공적으로 삭제된 경우 응답 반환
        res.status(200).json({ message: `User with ID ${uid} deleted successfully` });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Failed to delete user', error: error.message });
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
    const { uid, originalFandom, newFandom } = req.body; // 입력에서 필요한 필드만 추출

    try {
        const userDocRef = db.collection('users').doc(uid);

        // Firebase Admin SDK를 사용하여 작업 수행
        // 사용자 문서에 'choicechannel' 필드를 업데이트
        await userDocRef.update({ 'choicechannel': newFandom });

        // 팬덤 랭킹에서 사용자 데이터 삭제
        const fandomRankingRef = realtimeDB.ref(`ranking/fandom/${originalFandom}`);
        await fandomRankingRef.child(uid).remove();

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

export async function getUserWallet(req, res) {
    const { uid } = req.params;

    try {
        // Firebase Admin SDK를 사용하여 'users' 컬렉션의 특정 문서 참조
        const userDocRef = admin.firestore().collection('users').doc(uid).collection('wallet').doc('stock');
        const userMoneyHisotryDocRef = admin.firestore().collection('users').doc(uid).collection('wallet').doc('totalmoneyhistory');
        const userDocSnap = await userDocRef.get();
        const userMoneyHistoryDocSnap = await userMoneyHisotryDocRef.get();

        // 문서가 존재하는지 확인
        if (userMoneyHistoryDocSnap.exists) {
            // userDocSnap이 존재하는 경우에만 walletData를 가져옴
            const walletData = userDocSnap.exists ? userDocSnap.data() : {};

            // 성공적으로 사용자 데이터를 반환
            res.status(200).json({
                message: 'User retrieved successfully',
                data: walletData,
                moneyhistory: userMoneyHistoryDocSnap.data(),
            });
        } else {
            // 문서가 없을 경우 404 응답
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Error getting user:', error);
        res.status(500).json({ message: 'Failed to get document', error: error.message });
    }
}

export async function updateUserTotalMoney(req, res) {
    const { uid } = req.params;
    const { totalmoney, fandom, rank } = req.body;

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

        // 전체 랭킹에 저장
        const rankingRef = realtimeDB.ref('ranking/global');
        await rankingRef.child(uid).set({
            totalmoney,
            fandom,
            beforerank: rank,
        });

        // 팬덤별 랭킹에 저장
        const fandomRankingRef = realtimeDB.ref(`ranking/fandom/${fandom}`);
        await fandomRankingRef.child(uid).set({
            totalmoney,
            fandom,
            beforerank: rank,
        });

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

        // 현재 날짜 가져오기
        const currentDate = getDate(); // 날짜를 YYYY-MM-DD 형식으로 반환
        const currentMoney = parseInt(totalmoney, 10); // totalmoney를 정수형으로 변환

        // Firestore에서 문서 가져오기
        const totalmoneyDocSnap = await totalmoneyDocRef.get();

        if (totalmoneyDocSnap.exists) {
            // 기존 데이터 가져오기
            let historyData = totalmoneyDocSnap.data().totalmoneyhistory || [];
            let dateData = totalmoneyDocSnap.data().date || '2024-00-00';

            // 기존 날짜가 현재 날짜와 같은지 확인
            if (dateData === currentDate) {
                // 날짜가 같다면 최신 항목을 삭제하고 새로운 totalmoney 삽입
                historyData.pop();
            }

            // 새로운 항목 추가
            historyData.push({ money: currentMoney, date: currentDate });

            // Firestore에 업데이트
            await totalmoneyDocRef.update({
                totalmoneyhistory: historyData,
                date: currentDate
            });
        } else {
            // 문서가 존재하지 않는 경우 새로 생성하여 삽입
            await totalmoneyDocRef.set({
                totalmoneyhistory: [{ money: currentMoney, date: currentDate }],
                date: currentDate
            });
        }

        //console.log("User total money history updated successfully.");
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
        const date = getDate();

        // 거래 데이터 삭제
        await db.collection('users').doc(uid).collection('trade').doc('0').delete();
        await db.collection('users').doc(uid).collection('trade').doc('0_last').delete();
        await db.collection('users').doc(uid).collection('wallet').doc('stock').delete();

        // 사용자 문서 업데이트
        await userDocRef.update({
            money: initialMoney,
            'rank': 0,
            'totalmoney': initialMoney,
            'beforerank': 0,
        });

        // totalmoneyhistory에 초기 데이터 삽입
        await totalmoneyDocRef.set({
            totalmoneyhistory: [{ money: initialMoney, date: date }],
            date: date,
        });
        // 성공 응답
        res.status(201).json({ message: 'User data reset successfully', uid: uid });
    } catch (error) {
        console.error('Error resetting user data:', error);
        res.status(500).json({ message: 'Failed to reset user data', error: error.message });
    }
}

// 메세지 데이터 가져오기
export async function getUserMessageData(req, res) {
    const { uid } = req.params; // 클라이언트에서 전달된 UID

    try {
        // 'users' 컬렉션에서 해당 UID의 'message' 컬렉션 모든 문서 가져오기
        const userMessagesSnapshot = await db.collection('users').doc(uid).collection('message').get();

        if (userMessagesSnapshot.empty) {
            return res.status(404).json({ message: 'No messages found for the user.' });
        }

        // 각 문서를 데이터 객체로 변환
        const messages = userMessagesSnapshot.docs.map((doc) => ({
            ...doc.data(), // 문서 데이터
        }));

        // 클라이언트로 메시지 배열 응답
        res.status(200).json({ messages });
    } catch (error) {
        console.error('Error fetching user messages:', error);
        res.status(500).json({ message: 'Failed to fetch user messages.', error: error.message });
    }
}

export async function deleteMessageData(req, res) {
    const { uid } = req.params; // 클라이언트에서 전달된 사용자 UID
    const { messageUID } = req.body; // 삭제할 메시지의 문서 ID

    try {
        // 'users' 컬렉션 -> UID -> 'message' 하위 컬렉션 -> messageUID 문서 삭제
        await db.collection('users').doc(uid).collection('message').doc(messageUID).delete();

        // 성공 응답
        res.status(200).json({ message: `Message ${messageUID} deleted successfully.` });
    } catch (error) {
        console.error('Error deleting user message:', error);
        res.status(500).json({ message: 'Failed to delete user message.', error: error.message });
    }
}

export async function deleteAllMessage(req, res) {
    try {
        const { uid } = req.params;

        // 메시지 컬렉션 경로 정의
        const collectionPath = `users/${uid}/message`;

        // 모든 문서 가져오기
        const snapshot = await db.collection(collectionPath).get();

        if (snapshot.empty) {
            console.log(`No documents found in collection: ${collectionPath}`);
            return res.status(404).json({ message: `No messages found for user ${uid}` });
        }

        // 문서 삭제
        const deletePromises = snapshot.docs.map((doc) =>
            doc.ref.delete().then(() => console.log(`Deleted document: ${doc.id}`))
        );

        // 모든 문서 삭제 완료 대기
        await Promise.all(deletePromises);

        console.log(`Collection ${collectionPath} deleted successfully.`);
        res.status(200).json({ message: `All messages for user ${uid} deleted successfully.` });
    } catch (error) {
        console.error(`Error deleting collection ${collectionPath}:`, error);
        res.status(500).json({ message: 'Failed to delete messages.', error: error.message });
    }
}

