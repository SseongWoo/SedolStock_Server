import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 현재 파일의 디렉터리 이름을 얻기
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env 파일 경로 설정
dotenv.config({ path: path.resolve(__dirname, './.env') });
import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccountURL = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;
const storageBucketURL = process.env.FIREBASE_ADMIN_STORAGE_BUCKET;
const realtimeDBURL = process.env.FIREBASE_ADMIN_REALTIME_DATABASE_URL;

// JSON 파일을 CommonJS 방식으로 읽어오기
const serviceAccount = JSON.parse(
    fs.readFileSync(new URL(serviceAccountURL, import.meta.url))
);

// Firebase Admin 초기화
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: storageBucketURL, // Firebase Storage 버킷 이름 (프로젝트 설정에서 확인)
        databaseURL: realtimeDBURL,        // Realtime Database URL 추가
    });
}

// Firestore Admin 인스턴스 사용
const db = admin.firestore();
const bucket = admin.storage().bucket();
const FieldValue = admin.firestore.FieldValue; // FieldValue 가져오기
const realtimeDB = admin.database();

// Firebase Admin과 Firestore를 export
export { admin, db, bucket, FieldValue, realtimeDB };