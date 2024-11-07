// Firebase를 사용하기 위해 firebase 모듈을 import 합니다.
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics'; // Analytics를 지원할 때만 가져오기
import { getAuth } from '@firebase/auth';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const apiKey = process.env.FIREBASE_CONFIG_API_KEY;
const authDomain = process.env.FIREBASE_CONFIG_AUTH_DOMAIN;
const projectId = process.env.FIREBASE_CONFIG_PROJECT_ID;
const storageBucket = process.env.FIREBASE_CONFIG_STORAGE_BUCKET;
const messagingSenderId = process.env.FIREBASE_CONFIG_MESSAGING_SENDER_ID;
const appId = process.env.FIREBASE_CONFIG_APP_ID;
const measurementId = process.env.FIREBASE_CONFIG_MEASUREMENT_ID;


const firebaseConfig = {
    apiKey: apiKey,
    authDomain: authDomain,
    projectId: projectId,
    storageBucket: storageBucket,
    messagingSenderId: messagingSenderId,
    appId: appId,
    measurementId: measurementId
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);

// Firestore 인스턴스 생성
//const db = getFirestore(app);
const auth = getAuth(app);

// Analytics 초기화 (브라우저 환경에서만 지원 가능 여부를 확인 후 초기화)
if (typeof window !== 'undefined') {
    isSupported().then((supported) => {
        if (supported) {
            const analytics = getAnalytics(app);
            console.log('Analytics initialized');
        } else {
            console.log('Analytics is not supported in this environment');
        }
    }).catch((error) => {
        console.error('Error checking analytics support:', error);
    });
}

// Firestore 인스턴스를 export
export { auth, firebaseConfig };