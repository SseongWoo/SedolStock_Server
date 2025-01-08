import express from 'express';
import cors from 'cors';
import { signUpUser, signInUser, resetPassword, changePassword, sendEmail, checkEmail, deleteUserAuth, tokenLogin } from './controllers/authControllers.js';
import { getUserData, signUpUserData1, signUpUserData2, searchName, updateName, getUserWallet, updateUserTotalMoney, updateChoiceChannel, restartUserData, getUserMessageData, deleteMessageData, deleteAllMessage, deleteUser, signUpUserData } from './controllers/userControllers.js';
import { getUserTradeDataList, tryTrade } from './controllers/tradeControllers.js';
import { getChannelIdByName, getChannelInfoData, getVideoData, getLiveData, getLatestVideoInfo } from './controllers/youtubeControllers.js';
import { getRankData } from './controllers/rankControllers.js'
import { checkRunningServer, getConstantsData } from './controllers/severControllers.js'

// Express 애플리케이션 초기화
const app = express();
const PORT = 3000;
const apiRouter = express.Router();

// CORS 설정
app.use(cors());

// JSON 본문 파싱을 위해 설정
app.use(express.json());

// API 라우터 연결
app.use('/api', apiRouter);

apiRouter.get('/healthcheck', (req, res) => {
    res.status(200).send('OK');
});

// 서버가 열려있는지 확인
// apiRouter.get('/running', (req, res) => {
//     res.status(200).send('Server is running');
// });
apiRouter.get('/running', checkRunningServer);

// 회원가입 (POST /signup)
apiRouter.post('/signup', signUpUser);

// 로그인 (POST /signin)
apiRouter.post('/signin', signInUser);

// 자동 로그인
apiRouter.post('/signin/tokenlogin', tokenLogin);

// 사용자 인증 데이터 삭제
apiRouter.delete('/deleteUser', deleteUserAuth);

// 사용자 데이터 등록 (POST /users)
apiRouter.post('/signup/users', signUpUserData);

// 사용자 데이터 등록 (POST /users)
apiRouter.post('/users', signUpUserData1);

// 사용자 데이터 업데이트 (PUT /users/:id)
apiRouter.put('/users/set', signUpUserData2);

// 사용자 데이터 초기화
apiRouter.put('/users/restart', restartUserData);

// 사용자 이름으로 검색 (GET /names/:name)
apiRouter.get('/names/:name', searchName);

//apiRouter.post('/users/setprofile/:uid', setUserProfile);

// 사용자 이름 업데이트 (PUT /names/:name)
apiRouter.put('/names/update', updateName);

// // 사용자 데이터 삭제 (DELETE /users/:id)
apiRouter.delete('/users/:id', deleteUser);

// 사용자 데이터 가져오기 (GET /users/:uid)
apiRouter.get('/users/:uid', getUserData);

// 사용자 거래 데이터 처리 (PUT /trade/:uid/trade/0)
apiRouter.put('/trade/:uid/trade/0', tryTrade);

// 사용자 비밀번호 재설정 (POST /users/reset)
apiRouter.post('/users/reset', resetPassword);

// 사용자 비밀번호 변경 (POST /users/change)
apiRouter.post('/users/change', changePassword);

// 이메일 인증 요청 (POST /users/sendemail)
apiRouter.post('/users/sendemail', sendEmail);

// 이메일 인증 확인 (POST /users/checkemail)
apiRouter.post('/users/checkemail', checkEmail);

// 유튜브 채널 이름으로 UID 획득 (POST /youtube/getchannelid)
apiRouter.post('/youtube/getchannelid', getChannelIdByName);

//apiRouter.post('/youtube/updatechannelinfo', updateChannelInfoData);

apiRouter.get('/youtube/getchannelinfo', getChannelInfoData);

//apiRouter.post('/youtube/updatevideodata', updateVideoData);

apiRouter.get('/youtube/getvideodata', getVideoData);

//apiRouter.post('/youtube/updatelivedata', updateLiveData);

apiRouter.get('/youtube/getlivedata', getLiveData);

//apiRouter.post('/youtube/updateLatestVideoInfo', updateLatestVideoInfo);

apiRouter.get('/youtube/getLatestVideoInfo', getLatestVideoInfo);

apiRouter.get('/users/wallet/:uid', getUserWallet);

apiRouter.get('/users/tradeList/:uid', getUserTradeDataList);

//apiRouter.post('/rank/set', setRankData);

apiRouter.get('/rank/get', getRankData);

apiRouter.put('/users/updatetotalmoney/:uid', updateUserTotalMoney);

apiRouter.put('/fanname/update', updateChoiceChannel);

apiRouter.get('/users/message/:uid', getUserMessageData);

apiRouter.delete('/users/message/:uid', deleteMessageData);

apiRouter.delete('/users/allmessage/:uid', deleteAllMessage);

apiRouter.get('/config', getConstantsData);
// 서버 실행
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});