import { db, FieldValue } from '../firebase_admin.js';
import { getTime } from '../utils/date.js'
import { getJson } from '../utils/file.js'
import { Config } from '../config.js';

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
    const { uid } = req.params;
    const { itemuid, channeltype, itemcount, transactionprice, tradetype, priceavg } = req.body;

    const userLastTradeDocRef = db.collection('users').doc(uid).collection('trade').doc('0_last');

    const itemprice = await getPriceData(itemuid);
    const moneybefore = await getUserMoneyData(uid);
    const tradetime = new Date().toISOString();

    if (itemprice === null || moneybefore === null) {
        return res.status(500).json({ message: '가격 데이터를 불러오는데 실패하였습니다.' });
    }

    if (itemprice !== transactionprice) {
        console.error("무결성 오류: 현재의 아이템 가격과 요청된 아이템 가격이 다릅니다.");
        return res.status(403).json({ message: '무결성 오류: 현재의 아이템 가격과 요청된 아이템 가격이 다릅니다.' });
    }

    const feeRate = tradetype === 'buy' ? Config.FEE_CONFIG.buyFeeRate : Config.FEE_CONFIG.sellFeeRate;
    const totalPrice = itemprice * itemcount;
    const fee = Math.round(totalPrice * feeRate);
    let totalcost = tradetype === 'buy' ? totalPrice + fee : totalPrice - fee;
    let moneyafter = tradetype === 'buy' ? moneybefore - totalcost : moneybefore + totalcost;
    let totalPriceAvg = tradetype === 'buy' ? 0 : priceavg + (priceavg * feeRate);

    if (moneyafter < 0) {
        return res.status(403).json({ message: '오류: 사용자의 보유 재산을 넘는 요청입니다.' });
    }

    try {
        const tradeData = await getUserTradeListData(uid);
        if (Math.abs(moneybefore - tradeData.moneyafter) > 1) {
            console.error("무결성 오류");
            return res.status(403).json({ message: `무결성 오류: ${moneybefore}, ${tradeData.moneyafter}` });
        }

        await userLastTradeDocRef.set({
            'moneybefore': moneybefore,
            'moneyafter': moneyafter,
            'tradetime': tradetime,
            'itemuid': itemuid,
            'channelType': channeltype,
            'itemcount': itemcount,
            'transactionprice': transactionprice,
            'totalcost': totalcost,
            'tradeType': tradetype,
            'priceavg': totalPriceAvg,
            'fee': fee
        }, { merge: true });

        await updateUserTradeListData(uid, moneybefore, moneyafter, tradetime, itemuid, channeltype, itemcount, transactionprice, tradetype, totalPriceAvg, totalcost, fee);
        await updateUserWallet(uid, itemuid, itemcount, transactionprice, tradetype);
        await updateUserMoney(uid, moneyafter);
        await setStockCount(itemuid, uid, itemcount, tradetype);

        res.status(200).json({ message: "Success" });
    } catch (error) {
        console.error("Error processing trade document:", error);
        res.status(500).json({ message: "Failed to process trade document", error: error.message });
    }
}

// 사용자의 거래 내역 리스트 데이터를 업데이트 하는 작업
async function updateUserTradeListData(uid, moneyBefore, moneyAfter, tradeTime, itemUID, channeltype, itemCount, transactionPrice, tradetype, totalPriceAvg, totalcost, fee) {
    try {
        const userTradeListDocRef = db.collection('users').doc(uid).collection('trade').doc('0');
        const userTradeDocSnap = await userTradeListDocRef.get();

        if (userTradeDocSnap.exists) {
            let moneyBeforeList = userTradeDocSnap.data().moneybefore || [];
            let moneyAfterList = userTradeDocSnap.data().moneyafter || [];
            let channelTypeList = userTradeDocSnap.data().channeltype || [];
            let tradeTimeList = userTradeDocSnap.data().tradetime || [];
            let itemUIDList = userTradeDocSnap.data().itemuid || [];
            let itemCountList = userTradeDocSnap.data().itemcount || [];
            let transactionPriceList = userTradeDocSnap.data().transactionprice || [];
            let tradeTypeList = userTradeDocSnap.data().tradetype || [];
            let priceAvgList = userTradeDocSnap.data().priceavg || [];
            let totalCostList = userTradeDocSnap.data().totalcost || [];
            let feeList = userTradeDocSnap.data().fee || [];

            //console.log(moneyAfterList);

            // 거래 리스트가 50개를 초과할 경우 가장 오래된 항목 제거
            if (moneyBeforeList.length >= 100) {
                moneyBeforeList.shift();
                moneyAfterList.shift();
                channelTypeList.shift();
                tradeTimeList.shift();
                itemUIDList.shift();
                itemCountList.shift();
                transactionPriceList.shift();
                tradeTypeList.shift();
                priceAvgList.shift();
                totalCostList.shift();
                feeList.shift();
            }

            // 새 데이터를 리스트에 추가
            moneyBeforeList.push(moneyBefore);
            moneyAfterList.push(moneyAfter);
            channelTypeList.push(channeltype)
            tradeTimeList.push(tradeTime);
            itemUIDList.push(itemUID);
            itemCountList.push(itemCount);
            transactionPriceList.push(transactionPrice);
            tradeTypeList.push(tradetype);
            priceAvgList.push(totalPriceAvg);
            totalCostList.push(totalcost);
            feeList.push(fee);

            // Firestore 문서 업데이트
            await userTradeListDocRef.update({
                'moneybefore': moneyBeforeList,
                'moneyafter': moneyAfterList,
                'tradetime': tradeTimeList,
                'itemuid': itemUIDList,
                'channeltype': channelTypeList,
                'itemcount': itemCountList,
                'transactionprice': transactionPriceList,
                'tradetype': tradeTypeList,
                'priceavg': priceAvgList,
                'totalcost': totalCostList,
                'fee': feeList,
            });

        } else {
            // 문서가 존재하지 않을 경우 새로 생성
            await userTradeListDocRef.set({
                'moneybefore': [moneyBefore],
                'moneyafter': [moneyAfter],
                'tradetime': [tradeTime],
                'itemuid': [itemUID],
                'channeltype': [channeltype],
                'itemcount': [itemCount],
                'transactionprice': [transactionPrice],
                'tradetype': [tradetype],
                'priceavg': [totalPriceAvg],
                'totalcost': [totalcost],
                'fee': [fee],
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
                'itemcount': 0,
                'transactionprice': 0,
                'priceavg': 0,
                'totalcost': 0,
                'fee': 0,
            };
            await userTradeDocRef.set(defaultData); // 기본 데이터를 Firestore에 저장
            return defaultData;
        }
    } catch (error) {
        console.error("Error fetching user trade list data:", error);
        return 'error';
    }
}

export async function getPriceData(channelUID) {
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
        return channelData.price;
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
        // Firestore 참조
        const walletDocRef = db.collection('users').doc(uid).collection('wallet').doc('stock');

        // Firestore에서 사용자 지갑 데이터 가져오기
        const walletDocSnap = await walletDocRef.get();
        const walletData = walletDocSnap.exists ? walletDocSnap.data() : {};

        // 기존 주식 데이터 가져오기
        const stockData = walletData[stockName] || { stockCount: 0, stockPrice: 0 };

        // 수량 및 가격 계산
        const currentCount = stockData.stockCount;
        const countToAdd = parseInt(stockCount, 10);

        // 거래 타입 검증
        if (tradeType !== 'buy' && tradeType !== 'sell') {
            console.error('Invalid trade type.');
            return;
        }

        // 입력값 검증
        if (!Number.isInteger(countToAdd) || countToAdd <= 0) {
            console.error('Invalid stock count data.');
            return;
        }

        let updateCount;
        let updatePrice;

        if (tradeType === 'buy') {
            updateCount = currentCount + countToAdd;
            updatePrice = (stockData.stockPrice * currentCount + stockPrice * countToAdd) / updateCount;
        } else {
            updateCount = currentCount - countToAdd;
            updatePrice = updateCount > 0
                ? Math.round((stockData.stockPrice * currentCount - stockPrice * countToAdd) / updateCount)
                : 0;
        }

        // 업데이트할 데이터 준비
        const updatedData = {
            stockCount: updateCount,
            stockPrice: updatePrice,
        };

        // Firestore 업데이트
        if (walletDocSnap.exists) {
            await walletDocRef.update({
                [stockName]: updatedData,
            });
        } else {
            await walletDocRef.set({
                [stockName]: updatedData,
            });
        }

        console.log(`User wallet updated for ${stockName}:`, updatedData);
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
            //console.log(`User's money updated successfully for uid: ${uid}`);
        } else {
            // 문서가 존재하지 않으면 새로 생성
            await moneyDocRef.set({
                'money': money
            });
            //console.log(`User's money document created successfully for uid: ${uid}`);
        }
    } catch (error) {
        console.error("Error updating user money:", error);
    }
}

async function setStockCount(itemUid, uid, count, tradeType) {
    try {
        const docRef = db.collection('youtubelivedata')
            .doc('tradelist')
            .collection(itemUid)
            .doc(uid);

        if (tradeType === 'buy') {
            // 'buy'일 경우 stockcount를 증가
            await docRef.set(
                { stockcount: FieldValue.increment(count) },
                { merge: true }
            );
            //console.log(`Document at ${docRef.path} updated (stockcount incremented by ${count})`);
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
                    //console.log(`Document at ${docRef.path} deleted (stockcount reached 0 or below)`);
                } else {
                    // stockcount를 감소
                    transaction.update(docRef, { stockcount: FieldValue.increment(-count) });
                    //console.log(`Document at ${docRef.path} updated (stockcount decremented by ${count})`);
                }
            });
        }
    } catch (error) {
        console.error("Error in setStockCount:", error);
    }
}