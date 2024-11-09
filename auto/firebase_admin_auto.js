import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccountURL = process.env.FIREBASE_ADMIN_AUTO_SERVICE_ACCOUNT;
const storageBucketURL = process.env.FIREBASE_ADMIN_STORAGE_BUCKET;

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