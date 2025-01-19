# 주식 시뮬레이터 서버

## 세돌스탁 서버

<img src = "https://github.com/user-attachments/assets/8a8fbb0f-8ebd-432c-bf9b-44a294c380e4" width="350" height="350">

## 클라이언트 프로젝트

[클라이언트 프로젝트 링크](https://github.com/SseongWoo/SedolStock)

## 프로젝트 소개

이 프로젝트는 모의 투자 시뮬레이션 팬게임 “세돌스탁”의 백엔드 서버입니다.
유저들에게 실시간 데이터를 제공하고, 계정 관리, 주식 거래, 랭킹 시스템, 이벤트 관리 등의 기능을 지원합니다.
또한, 유튜브 데이터를 기반으로 아이템의 가격을 산정하며, 다양한 자동화 작업을 통해 실시간 데이터를 지원합니다.

## 디렉토리 구조

### auto 폴더

자동화 작업 및 스케줄링 관련 파일을 관리하는 폴더로, AWS EC2의 크론 스케줄러를 통해 특정 시간 간격으로 실행됩니다.

- **day.js, dayControllers.js**
  - 하루 단위로 실행되는 데이터 처리 스케줄 파일입니다.
  - 주요 기능: 채널의 최신 영상 데이터 처리, 삭제 예정 계정 정리, 이벤트 설정 데이터 처리
- **minute.js, minute10.js, minuteControllers.js**
  - 각각 5분, 10분 단위로 실행되는 데이터 처리 스케줄 파일입니다.
  - 주요 기능: 주식 아이템들의 가격 데이터 처리, Play Store 버전 확인후 서버 데이터 갱신 기능
- **our.js, hourControllers.js**

  - 한 시간 단위로 실행되는 데이터 처리 스케줄 파일입니다.
  - 주요 기능: 랭킹 데이터 갱신, 서버 설정 데이터 업데이트

- **week.js, weekControllers.js**
  - 주 단위로 실행되는 데이터 처리 스케줄 파일입니다.
  - 주요 기능: 채널의 정보 갱신

### controllers 폴더

API 요청을 처리하고 Firestore, Realtime Database 등 사용자와 백엔드와의 상호작용을 관리하는 주요 로직을 포함한 폴더입니다.

- **serverControllers.js**

  - 서버 관리 및 설정 관련 요청을 처리합니다.
  - 주요 기능: 서버 설정 데이터 제공, 서버 상태 확인, 플레이스토어 버전 확인, 이벤트 데이터 제공

- **authControllers.js**

  - 사용자 인증 및 계정 관리를 담당합니다.
  - 주요 기능: 로그인, 회원가입, 비밀번호 변경, 인증 토큰 관리

- **rankControllers.js**

  - 사용자 랭킹 데이터관련 요청을 처리합니다.
  - 주요 기능: 전체 랭킹 데이터 제공

- **tradeControllers.js**
  - 거래 관련 API 요청을 처리합니다.
  - 주요 기능: 주식 구매 및 판매, 사용자 거래 내역 목록 데이터 제공
- **userControllers.js**

  - 사용자 정보 관련 요청을 처리합니다.
  - 주요 기능: 사용자 정보 업데이트, 자산 초기화, 사용자 메세지 데이터 관리

- **youtubeControllers.js**
  - 유튜브 데이터 관련 요청을 처리합니다.
  - 주요 기능: 유튜브 API를 통해 채널 및 영상 데이터를 제공

### 디렉토리 트리 구조

```sh
├── index.js                    # 애플리케이션 초기화 및 라우터 연결 설정 메인파일
├── firebase.js                 # Firebase 서비스 설정 파일
├── firebase_admin.js           # 인증, Firestore 데이터베이스 기능을 사용하기 위한 Firebase Admin SDK 설정 파일
├──auto                         # AWS EC2 에서 스케줄러로 사용할 폴더
│   ├── day.js                  # 하루 단위 데이터 처리 파일
│   ├── dayControllers.js       # 하루 단위 데이터 처리 파일 컨트롤러
│   ├── minute.js               # 5분 단위 데이터 처리 파일
│   ├── minuteControllers.js    # 5분 단위 데이터 처리 파일 컨트롤러
│   ├── minute10.js             # 10분 단위 데이터 처리 파일
│   ├── hour.js                 # 한시간 단위 데이터 처리 파일
│   ├── hourControllers.js      # 한시간 단위 데이터 처리 파일 컨트롤러
│   ├── week.js                 # 주 단위 데이터 처리 파일
│   └── weekControllers.js      # 주 단위 데이터 처리 파일 컨트롤러
├── controllers                 # API 요청을 처리하는 주요 컨트롤러 폴터
│   ├── serverControllers.js      # 사용자 인증 및 계정 관리 파일
│   ├── authControllers.js      # 사용자 인증 및 계정 관리 파일
│   ├── rankControllers.js      # 사용자 랭킹 데이터 관리 파일
│   ├── tradeControllers.js     # 거래 관련 데이터 관리 파일
│   ├── userControllers.js      # 사용자 데이터 관리 파일
│   └── youtubeControllers.js   # 유튜브 데이터 관리 파일
├── utils
│   ├── date.js                 # 날짜 형식 변환 기능 파일
│   └── file.js                 # json 파일 읽기 쓰기 기능 파일
└── json                        # json 데이터 파일 폴더
```
