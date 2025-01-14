import { updateLatestVideoInfo, updateVideoData, startDeleteUserData } from './controllers.js';

// 채널의 영상들 업데이트
await updateVideoData();

// 채널의 제일 최신영상 업데이트
await updateLatestVideoInfo();

// 삭제 예정인 계정들 삭제
await startDeleteUserData();