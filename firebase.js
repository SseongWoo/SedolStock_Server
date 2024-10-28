// Firebase를 사용하기 위해 firebase 모듈을 import 합니다.
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics'; // Analytics를 지원할 때만 가져오기
import { getAuth } from '@firebase/auth';

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyAsSJwaHWZvEjWhdDLLc9eLS43Sx1qjLUc",
    authDomain: "stockprojecttest-10805.firebaseapp.com",
    projectId: "stockprojecttest-10805",
    storageBucket: "stockprojecttest-10805.appspot.com",
    messagingSenderId: "300613032247",
    appId: "1:300613032247:web:7fef9a7ffc082948cb22b2",
    measurementId: "G-431ZW07WPX"
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