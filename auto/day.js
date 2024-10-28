import { setRankData } from '../controllers/rankControllers.js';
import { updateLatestVideoInfo, updateVideoData } from '../controllers/youtubeControllers.js'


// 랭킹 업데이트
await setRankData();

// 채널의 영상들 업데이트
await updateVideoData();

// 채널의 제일 최신영상 업데이트
await updateLatestVideoInfo();