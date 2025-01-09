# 주식 시뮬레이터 서버
## 세돌스탁 서버
<img src = "https://github.com/user-attachments/assets/8a8fbb0f-8ebd-432c-bf9b-44a294c380e4" width="350" height="350">

## 클라이언트 프로젝트
[클라이언트 프로젝트 링크](https://github.com/SseongWoo/SedolStock)

## 디렉토리 구조
```sh
├── index.js                    # 애플리케이션 초기화 및 라우터 연결 설정 메인파일
├── firebase.js                 # Firebase 서비스 설정 파일
├── firebase_admin.js           # 인증, Firestore 데이터베이스 기능을 사용하기 위한 Firebase Admin SDK 설정 파일
├── config.js                   # 서버 주요 설정값 파일
├──auto                         # AWS EC2 에서 스케줄러로 사용할 폴더
│   ├── controllers.js          # 자동화 작업을 관리하는 주요 컨트롤러 파일
│   ├── day.js                  # 하루 단위 데이터 처리 파일
│   ├── minute.js               # 5분 단위 데이터 처리 파일
│   ├── minute10.js             # 10분 단위 데이터 처리 파일
│   └── week.js                 # 주 단위 데이터 처리 파일
├── controllers                 # API 요청을 처리하는 주요 컨트롤러 폴터
│   ├── authControllers.js      # 사용자 인증 및 계정 관리 파일
│   ├── serverControllers.js    # 서버 상태 확인 및 주요 설정값 데이터 관리 파일
│   ├── rankControllers.js      # 사용자 랭킹 데이터 관리 파일
│   ├── tradeControllers.js     # 거래 관련 데이터 관리 파일
│   ├── userControllers.js      # 사용자 데이터 관리 파일
│   └── youtubeControllers.js   # 유튜브 데이터 관리 파일
├── utils
│   ├── date.js                 # 날짜 형식 변환 기능 파일
│   └── file.js                 # json 파일 읽기 쓰기 기능 파일
└── json                        # json 데이터 파일 폴더
```
