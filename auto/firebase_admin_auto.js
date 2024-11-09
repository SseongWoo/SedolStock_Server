import { serviceAccountURL, storageBucketURL } from './env.js';
import admin from 'firebase-admin';
import fs from 'fs';

console.log('Service Account URL:', serviceAccountURL); // 디버깅 용도
console.log('Storage Bucket URL:', storageBucketURL); // 디버깅 용도

// JSON 파일을 CommonJS 방식으로 읽어오기
const serviceAccount = JSON.parse(
    fs.readFileSync(new URL(serviceAccountURL, import.meta.url))
);

// Firebase Admin 초기화
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: storageBucketURL // Firebase Storage 버킷 이름 (프로젝트 설정에서 확인)
    });
}

// Firestore Admin 인스턴스 사용
const db = admin.firestore();
const bucket = admin.storage().bucket();


// Firebase Admin과 Firestore를 export
export { admin, db, bucket };