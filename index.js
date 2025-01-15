import express from 'express';
import cors from 'cors';
import { signUpUser, signInUser, resetPassword, changePassword, sendEmail, checkEmail, deleteUserAuth, tokenLogin } from './controllers/authControllers.js';
import { getUserData, signUpUserData1, signUpUserData2, searchName, updateName, getUserWallet, updateUserTotalMoney, updateChoiceChannel, restartUserData, getUserMessageData, deleteMessageData, deleteAllMessage, deleteUser, signUpUserData } from './controllers/userControllers.js';
import { getUserTradeDataList, tryTrade } from './controllers/tradeControllers.js';
import { getChannelInfoData, getVideoData, getLiveData, getLatestVideoInfo } from './controllers/youtubeControllers.js';
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

// 서버 상태 확인 및 버전 요청
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

// 채널 데이터 요청
apiRouter.get('/youtube/getchannelinfo', getChannelInfoData);

// 비디오 데이터 요청
apiRouter.get('/youtube/getvideodata', getVideoData);

// 채널 가격 데이터 요청
apiRouter.get('/youtube/getlivedata', getLiveData);

// 최근 영상 데이터 요청
apiRouter.get('/youtube/getLatestVideoInfo', getLatestVideoInfo);

// 사용자의 지갑 데이터 요청
apiRouter.get('/users/wallet/:uid', getUserWallet);

// 사용자의 거래 내역 요청
apiRouter.get('/users/tradeList/:uid', getUserTradeDataList);

// 랭킹 데이터 요청
apiRouter.get('/rank/get', getRankData);

// 사용자의 보유 자산 업데이트
apiRouter.put('/users/updatetotalmoney/:uid', updateUserTotalMoney);

// 팬덤 업데이트
apiRouter.put('/fanname/update', updateChoiceChannel);

// 사용자의 메세지 요청
apiRouter.get('/users/message/:uid', getUserMessageData);

// 사용자의 메세지 삭제 요청
apiRouter.delete('/users/message/:uid', deleteMessageData);

// 사용자의 전체 메세지 삭제 요청
apiRouter.delete('/users/allmessage/:uid', deleteAllMessage);

// 서버의 설정값 요청
apiRouter.get('/config', getConstantsData);

// 서버 실행
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});