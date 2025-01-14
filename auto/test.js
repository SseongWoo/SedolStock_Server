//import { startDeleteUserData } from '../controllers/authControllers.js'
// import { setRankData } from '../controllers/rankControllers.js'
// import { google } from 'googleapis';
import { setRankData } from "./controllers.js";
import { getLatestVideoInfo } from "../controllers/youtubeControllers.js"

// // YouTube API 인스턴스를 생성합니다.
// const youtube = google.youtube({
//     version: 'v3',
//     auth: 'AIzaSyDBjkLDGGibdXHlIU3mQGoUrZNxkfa-NeU' // 실제 API 키를 여기에 입력하세요.
// });

// // 유튜브 채널의 uid 가져오기
// async function getChannelIdByName() {
//     const channelName = '우왁굳의 반찬가게';

//     if (!channelName) {
//         console.error('channelName is required');
//     }

//     try {
//         // YouTube Data API를 사용하여 채널 검색
//         const response = await youtube.search.list({
//             part: 'snippet',
//             q: channelName,          // 검색어로 채널 이름을 입력
//             type: 'channel',         // 채널 유형으로 제한
//             maxResults: 1            // 첫 번째 검색 결과만 가져옵니다.
//         });

//         // 검색 결과에서 채널 ID 추출
//         const channels = response.data.items;
//         if (channels.length > 0) {
//             const channelId = channels[0].snippet.channelId;
//             console.log(channelId);
//         } else {
//             console.error('No channel found with the name');
//         }
//     } catch (error) {
//         console.error('Error fetching channel ID:', error);

//     }
// }

// getChannelIdByName();

setRankData();