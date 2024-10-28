import express from 'express';
import { signUpUser, signInUser, resetPassword, changePassword, sendEmail, checkEmail, deleteUserAuth, tokenLogin } from './controllers/authControllers.js';
import { getUserData, deleteUser, signUpUserData1, signUpUserData2, searchName, updateName, getUserWallet, updateUserTotalMoney } from './controllers/userControllers.js';
import { getUserTradeDataList, tryTrade } from './controllers/tradeControllers.js';
import { getChannelIdByName, updateChannelInfoData, getChannelInfoData, updateVideoData, getVideoData, updateLiveData, getLiveData, updateLatestVideoInfo, getLatestVideoInfo } from './controllers/youtubeControllers.js';
import { getRankData, setRankData } from './controllers/rankControllers.js'

// Express 애플리케이션 초기화
const app = express();
const PORT = 3000;

// JSON 본문 파싱을 위해 설정
app.use(express.json());

// 서버가 열려있는지 확인
app.get('/running', (req, res) => {
    res.status(200).send('Server is running');
});

// 회원가입 (POST /signup)
app.post('/signup', signUpUser);

// 로그인 (POST /signin)
app.post('/signin', signInUser);

// 자동 로그인
app.post('/signin/tokenlogin', tokenLogin);

// 사용자 인증 데이터 삭제
app.post('/deleteUser/:uid', deleteUserAuth);

// 사용자 데이터 등록 (POST /users)
app.post('/users', signUpUserData1);

// 사용자 데이터 업데이트 (PUT /users/:id)
app.put('/users/set', signUpUserData2);

// 사용자 이름으로 검색 (GET /names/:name)
app.get('/names/:name', searchName);

//app.post('/users/setprofile/:uid', setUserProfile);

// 사용자 이름 업데이트 (PUT /names/:name)
app.put('/names/:name', updateName);

// 사용자 데이터 삭제 (DELETE /users/:id)
app.delete('/users/:id', deleteUser);

// 사용자 데이터 가져오기 (GET /users/:uid)
app.get('/users/:uid', getUserData);

// 사용자 거래 데이터 처리 (PUT /trade/:uid/trade/0)
app.put('/trade/:uid/trade/0', tryTrade);

// 사용자 비밀번호 재설정 (POST /users/reset)
app.post('/users/reset', resetPassword);

// 사용자 비밀번호 변경 (POST /users/change)
app.post('/users/change', changePassword);

// 이메일 인증 요청 (POST /users/sendemail)
app.post('/users/sendemail', sendEmail);

// 이메일 인증 확인 (POST /users/checkemail)
app.post('/users/checkemail', checkEmail);

// 유튜브 채널 이름으로 UID 획득 (POST /youtube/getchannelid)
app.post('/youtube/getchannelid', getChannelIdByName);

app.post('/youtube/updatechannelinfo', updateChannelInfoData);

app.get('/youtube/getchannelinfo', getChannelInfoData);

app.post('/youtube/updatevideodata', updateVideoData);

app.get('/youtube/getvideodata', getVideoData);

app.post('/youtube/updatelivedata', updateLiveData);

app.get('/youtube/getlivedata', getLiveData);

app.post('/youtube/updateLatestVideoInfo', updateLatestVideoInfo);

app.get('/youtube/getLatestVideoInfo', getLatestVideoInfo);

app.get('/users/wallet/:uid', getUserWallet);

app.get('/users/tradeList/:uid', getUserTradeDataList);

app.post('/rank/set', setRankData);

app.get('/rank/get', getRankData);

app.put('/users/updatetotalmoney/:uid', updateUserTotalMoney);

// 서버 실행
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});