import { db, FieldValue } from '../firebase_admin.js';
import { getTime } from '../utils/date.js'
import { getJson } from '../utils/file.js'

// 사용자 거래 데이터 최대 30일 까지만
export async function getUserTradeDataList(req, res) {
    const { uid } = req.params;

    try {
        // users/{uid}/trade/0 경로의 문서 참조
        const userTradeDocRef = db.collection('users').doc(uid).collection('trade').doc('0');
        const userTradeDocSnap = await userTradeDocRef.get();

        // 문서가 존재하는지 확인
        if (userTradeDocSnap.exists) {
            // 문서 데이터를 JSON 형식으로 반환
            res.status(200).json(userTradeDocSnap.data());
        } else {
            // 문서가 존재하지 않으면 404 응답
            res.status(404).json({ message: "Document not found." });
        }
    } catch (error) {
        console.error("Error fetching trade document:", error);
        // 에러 발생 시 500 응답
        res.status(500).json({ message: "Failed to fetch trade document", error: error.message });
    }
}

// 거래 시도후 문제없으면 그대로 진행
export async function tryTrade(req, res) {
    const { uid } = req.params; // 사용자 ID
    const { itemuid, itemtype, itemcount, transactionprice, type, priceavg } = req.body; // 요청 본문에서 거래 정보 가져오기

    console.log("priceavg: ", priceavg); // 거래 전, 로그 추가

    // Firebase Firestore 경로 설정
    //const userTradeDocRef = db.collection('users').doc(uid).collection('trade').doc(getTime());
    const userLastTradeDocRef = db.collection('users').doc(uid).collection('trade').doc('0_last');

    // 비동기 함수 호출 시 await 사용
    const itemprice = await getPriceData(itemuid, itemtype);
    const moneybefore = await getUserMoneyData(uid);
    const tradetime = new Date().toISOString(); // 시간은 ISO 문자열로 저장
    let moneyafter = 0;
    const feeRate = 0.05;
    // 데이터가 없을 경우의 오류 처리
    if (itemprice === null || moneybefore === null) {
        return res.status(500).json({ message: '가격 데이터를 불러오는데 실패하였습니다.' });
    }

    // 가격 무결성 체크
    if (itemprice !== transactionprice) {
        console.error("E무결성 오류 : 현재의 아이템 가격과 요청된 아이템 가격이 다릅니다.");
        return res.status(403).json({ message: '무결성 오류 : 현재의 아이템 가격과 요청된 아이템 가격이 다릅니다.' });
    }

    let fee = Math.round((itemprice * itemcount) * feeRate);
    // 거래 유형에 따른 계산 처리
    if (type === 'buy') {
        if (moneybefore >= (itemprice * itemcount) + fee) {
            moneyafter = Math.round(moneybefore - (itemprice * itemcount) + fee);
        } else {
            console.error("오류 : 사용자의 보유 재산을 넘는 요청입니다.");
            return res.status(403).json({ message: '오류 : 사용자의 보유 재산을 넘는 요청입니다.' });
        }
    } else if (type === 'sell') {
        moneyafter = moneybefore + (itemprice * itemcount);
    } else {
        console.error("오류 : 잘못된 인수로 요청되었습니다.");
        return res.status(403).json({ message: '오류 : 잘못된 인수로 요청되었습니다.' });
    }

    // 거래 데이터 가져오기 함수
    const tradeData = await getUserTradeListData(uid);

    // 매개변수 타입 확인
    if (typeof moneybefore !== 'number' || typeof moneyafter !== 'number' ||
        typeof itemuid !== 'string' || typeof itemtype !== 'string' ||
        typeof itemcount !== 'number' || typeof tradetime !== 'string' ||
        typeof transactionprice !== 'number' || typeof type !== 'string') {
        return res.status(400).json({ message: "Invalid input data" });
    }

    try {
        // tradeData가 오류가 아닐 때 실행
        if (tradeData !== 'error') {
            // 무결성 확인
            if (moneybefore === tradeData.moneyafter) {
                // 거래 데이터 Firestore에 저장
                // await userTradeDocRef.set({
                //     'moneybefore': moneybefore,
                //     'moneyafter': moneyafter,
                //     'tradetime': tradetime,
                //     'itemuid': itemuid,
                //     'itemtype': itemtype,
                //     'itemcount': itemcount,
                //     'transactionprice': transactionprice,
                //     'type': type,
                //     'priceavg': priceavg,
                // });

                // 마지막 거래 정보 업데이트
                await userLastTradeDocRef.update({
                    'moneybefore': moneybefore,
                    'moneyafter': moneyafter,
                    'tradetime': tradetime,
                    'itemuid': itemuid,
                    'itemtype': itemtype,
                    'itemcount': itemcount,
                    'transactionprice': transactionprice,
                    'type': type,
                    'priceavg': priceavg,
                });

                // 거래 리스트 업데이트 함수 호출
                await updateUserTradeListData(uid, moneybefore, moneyafter, tradetime, itemuid, itemcount, transactionprice, itemtype, type, priceavg);
                // 사용자 지갑 업데이트
                await updateUserWallet(uid, `${itemuid}_${itemtype}`, itemcount, transactionprice, type);

                await updateUserMoney(uid, moneyafter);

                await setStockCount(itemuid, itemtype, uid, itemcount, type)



                // 성공 응답
                res.status(200).json({ message: "Success" });
            } else {
                // 무결성 오류 발생 시
                console.error("무결성 오류");
                return res.status(403).json({ message: `무결성 오류: ${moneybefore}, ${tradeData.moneyafter}` });
            }
        } else {
            // 거래 데이터를 가져오는 데 실패했을 때
            return res.status(500).json({ message: "Failed to fetch trade document" });
        }
    } catch (error) {
        // 거래 처리 중 오류 발생 시
        console.error("Error processing trade document:", error);
        return res.status(500).json({ message: "Failed to process trade document", error: error.message });
    }
}

// 사용자의 거래 내역 리스트 데이터를 업데이트 하는 작업
async function updateUserTradeListData(uid, moneyBefore, moneyAfter, tradeTime, itemUID, itemCount, transactionPrice, itemtype, type, priceAvg) {
    try {
        const userTradeListDocRef = db.collection('users').doc(uid).collection('trade').doc('0');
        const userTradeDocSnap = await userTradeListDocRef.get();

        if (userTradeDocSnap.exists) {
            let moneyBeforeList = userTradeDocSnap.data().moneybefore || [];
            let moneyAfterList = userTradeDocSnap.data().moneyafter || [];
            let tradeTimeList = userTradeDocSnap.data().tradetime || [];
            let itemUIDList = userTradeDocSnap.data().itemuid || [];
            let itemTypeList = userTradeDocSnap.data().itemtype || [];
            let itemCountList = userTradeDocSnap.data().itemcount || [];
            let transactionPriceList = userTradeDocSnap.data().transactionprice || [];
            let typeList = userTradeDocSnap.data().type || [];
            let priceAvgList = userTradeDocSnap.data().priceavg || [];

            console.log(moneyAfterList);

            // 거래 리스트가 50개를 초과할 경우 가장 오래된 항목 제거
            if (moneyBeforeList.length >= 100) {
                moneyBeforeList.shift();
                moneyAfterList.shift();
                tradeTimeList.shift();
                itemUIDList.shift();
                itemTypeList.shift();
                itemCountList.shift();
                transactionPriceList.shift();
                typeList.shift();
                priceAvgList.shift();
            }

            // 새 데이터를 리스트에 추가
            moneyBeforeList.push(moneyBefore);
            moneyAfterList.push(moneyAfter);
            tradeTimeList.push(tradeTime);
            itemUIDList.push(itemUID);
            itemTypeList.push(itemtype);
            itemCountList.push(itemCount);
            transactionPriceList.push(transactionPrice);
            typeList.push(type);
            priceAvgList.push(priceAvg);

            // Firestore 문서 업데이트
            await userTradeListDocRef.update({
                'moneybefore': moneyBeforeList,
                'moneyafter': moneyAfterList,
                'tradetime': tradeTimeList,
                'itemuid': itemUIDList,
                'itemtype': itemTypeList,
                'itemcount': itemCountList,
                'transactionprice': transactionPriceList,
                'type': typeList,
                'priceavg': priceAvgList,
            });

        } else {
            // 문서가 존재하지 않을 경우 새로 생성
            await userTradeListDocRef.set({
                'moneybefore': [moneyBefore],
                'moneyafter': [moneyAfter],
                'tradetime': [tradeTime],
                'itemuid': [itemUID],
                'itemtype': [itemtype],
                'itemcount': [itemCount],
                'transactionprice': [transactionPrice],
                'type': [type],
                'priceavg': [priceAvg],
            });
        }

        return 'success'; // 성공 시 반환
    } catch (error) {
        console.error("Error updating trade list data:", error);
        return 'error'; // 실패 시 'error' 반환
    }
}


// 사용자의 마지막 거래 데이터를 가져오는 작업
async function getUserTradeListData(uid) {
    try {
        // Firestore 문서 참조
        const userTradeDocRef = db.collection('users').doc(uid).collection('trade').doc('0_last');

        // 문서 가져오기
        const userTradeDocSnap = await userTradeDocRef.get();

        if (userTradeDocSnap.exists) {
            // 문서가 존재하면 데이터 반환
            return userTradeDocSnap.data();
        } else {
            // 문서가 존재하지 않으면 기본 데이터 생성
            const defaultData = {
                'moneybefore': 0,
                'moneyafter': 1000000,
                'tradetime': '0',
                'itemuid': '0',
                'itemtype': '0',
                'itemcount': 0,
                'transactionprice': 0,
                'type': '0',
                'priceavg': 0,
            };
            await userTradeDocRef.set(defaultData); // 기본 데이터를 Firestore에 저장
            return defaultData;
        }
    } catch (error) {
        console.error("Error fetching user trade list data:", error);
        return 'error';
    }
}

export async function getPriceData(channelUID, itemtype) {
    try {
        // JSON 파일에서 데이터를 가져옴
        const priceData = await getJson('../json/liveData.json');

        // 데이터가 존재하는지 확인
        if (!priceData || !priceData[channelUID]) {
            console.log(`No data found for channelUID: ${channelUID}`);
            return null;
        }

        // 채널 데이터 가져오기
        const channelData = priceData[channelUID];

        // itemtype 값에 따른 가격 데이터 반환
        if (itemtype === 'view') {
            return channelData.viewCountPrice;
        } else if (itemtype === 'comment') {
            return channelData.commentCountPrice;
        } else if (itemtype === 'like') {
            return channelData.likeCountPrice;
        } else {
            console.log(`Invalid itemtype: ${itemtype}`);
            return null; // 잘못된 itemtype의 경우 null 반환
        }
    } catch (error) {
        console.error("Error fetching data from JSON file:", error);
        return null;
    }
}

async function getUserMoneyData(userUID) {
    try {
        // Firestore의 'users' 컬렉션의 특정 문서 참조
        const moneyDocRef = db.collection('users').doc(userUID);

        // Firestore에서 해당 문서의 데이터를 가져옴
        const moneyDocSnap = await moneyDocRef.get();

        // 문서가 존재하는지 확인
        if (moneyDocSnap.exists) {
            const moneyData = moneyDocSnap.data();

            // 데이터가 존재하는지 확인하고 'money' 필드 반환
            if (moneyData && typeof moneyData.money !== 'undefined') {
                return moneyData.money;
            } else {
                console.log(`No "money" field found for userUID: ${userUID}`);
                return null;
            }
        } else {
            console.log("No such document!");
            return null;
        }
    } catch (error) {
        console.error("Error fetching document:", error);
        return null;
    }
}

async function updateUserWallet(uid, stockName, stockCount, stockPrice, tradeType) {
    try {
        // Firestore의 'wallet' 컬렉션에서 특정 사용자 문서를 참조
        const walletDocRef = db.collection('users').doc(uid).collection('wallet').doc('stock');

        // Firestore에서 해당 사용자의 지갑 데이터를 가져옵니다
        const walletDocSnap = await walletDocRef.get();

        if (walletDocSnap.exists) {
            // 문서가 존재할 경우 데이터 가져오기
            const walletData = walletDocSnap.data();

            // `stockName`을 키로 데이터 찾기
            let keyToUpdate = null;
            for (const key in walletData) {
                if (walletData[key].stockName === stockName) {
                    keyToUpdate = key;
                    break;
                }
            }

            if (keyToUpdate) {
                // 데이터 타입 검사 및 유효성 확인
                const currentCount = parseInt(walletData[keyToUpdate].stockCount, 10);
                const countToAdd = parseInt(stockCount, 10);

                if (isNaN(currentCount) || isNaN(countToAdd) || currentCount < 0 || countToAdd < 0) {
                    console.error('Invalid stock count data.');
                    return;
                }
                let updateCount
                let updatePrice
                // 수량과 가격 계산
                if (tradeType == 'buy') {
                    updateCount = currentCount + countToAdd;
                    updatePrice = updateCount > 0
                        ? walletData[keyToUpdate].stockPrice + (stockPrice * countToAdd)
                        : 0;
                } else {
                    updateCount = currentCount - countToAdd;
                    updatePrice = updateCount > 0
                        ? walletData[keyToUpdate].stockPrice - (stockPrice * countToAdd)
                        : 0;
                }

                // 업데이트된 데이터를 객체로 생성
                const updatedData = {
                    ...walletData[keyToUpdate],
                    stockCount: updateCount,
                    stockPrice: updatePrice
                };

                // Firestore에 데이터 업데이트
                await walletDocRef.update({
                    [keyToUpdate]: updatedData
                });

                console.log(`User wallet updated successfully for key: ${keyToUpdate}`);
            } else {
                console.log(`No matching key found with stockName: ${stockName}`);
            }
        } else {
            console.log("No such document exists!");
        }
    } catch (error) {
        console.error("Error updating user wallet with stock types:", error);
    }
}

async function updateUserMoney(uid, money) {
    try {
        // Firestore의 'users' 컬렉션에서 특정 사용자 문서를 참조
        const moneyDocRef = db.collection('users').doc(uid);

        // 사용자 문서가 존재하는지 확인
        const userDocSnap = await moneyDocRef.get();

        if (userDocSnap.exists) {
            // 문서가 존재하면 업데이트 진행
            await moneyDocRef.update({
                'money': money
            });
            console.log(`User's money updated successfully for uid: ${uid}`);
        } else {
            // 문서가 존재하지 않으면 새로 생성
            await moneyDocRef.set({
                'money': money
            });
            console.log(`User's money document created successfully for uid: ${uid}`);
        }
    } catch (error) {
        console.error("Error updating user money:", error);
    }
}

async function setStockCount(itemUid, itemType, uid, count, type) {
    try {
        const docRef = db.collection('youtubelivedata')
            .doc('tradelist')
            .collection(`${itemUid}_${itemType}`)
            .doc(uid);

        if (type === 'buy') {
            // 'buy'일 경우 stockcount를 증가
            await docRef.set(
                { stockcount: FieldValue.increment(count) },
                { merge: true }
            );
            console.log(`Document at ${docRef.path} updated (stockcount incremented by ${count})`);
        } else {
            // 'sell'과 같은 경우 stockcount 감소 후 조건에 따라 삭제
            await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(docRef);

                if (!doc.exists) {
                    console.log('Document does not exist');
                    return;
                }

                const currentStockCount = doc.data().stockcount || 0; // 기본값 0
                const newStockCount = currentStockCount - count;

                if (newStockCount <= 0) {
                    // stockcount가 0 이하라면 문서 삭제
                    transaction.delete(docRef);
                    console.log(`Document at ${docRef.path} deleted (stockcount reached 0 or below)`);
                } else {
                    // stockcount를 감소
                    transaction.update(docRef, { stockcount: FieldValue.increment(-count) });
                    console.log(`Document at ${docRef.path} updated (stockcount decremented by ${count})`);
                }
            });
        }
    } catch (error) {
        console.error("Error in setStockCount:", error);
    }
}