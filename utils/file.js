import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// 현재 파일의 디렉터리 이름을 얻기
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function controllVersionFile(type, versionCode, versionName) {
    const jsonPath = path.resolve(__dirname, '../json/version.json');

    if (type === 'get') {
        // JSON 파일이 존재하는지 확인
        if (fs.existsSync(jsonPath)) {
            const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            //console.log('현재 버전 정보:', jsonData);
            return jsonData; // 버전 정보 반환
        } else {
            console.log('버전 파일이 존재하지 않습니다.');
            return null;
        }
    } else if (type === 'update') {
        const initialData = {
            versionCode: versionCode || '1.0.0', // 기본 값 설정
            versionName: versionName || 'Initial Version',
            updatedAt: new Date().toISOString() // 업데이트 시간 추가
        };

        if (!fs.existsSync(jsonPath)) {
            // JSON 파일이 없으면 새로 생성
            fs.writeFileSync(jsonPath, JSON.stringify(initialData, null, 2), 'utf8');
            //console.log('JSON 파일이 새로 생성되었습니다:', jsonPath);
        } else {
            // JSON 파일이 있으면 데이터 업데이트
            const existingData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

            // 버전 정보 업데이트
            existingData.versionCode = versionCode || existingData.versionCode;
            existingData.versionName = versionName || existingData.versionName;
            existingData.updatedAt = new Date().toISOString();

            // 파일 저장
            fs.writeFileSync(jsonPath, JSON.stringify(existingData, null, 2), 'utf8');
            //console.log('JSON 파일이 업데이트되었습니다:', existingData);
        }
    } else {
        console.log('올바른 type 값을 입력해주세요. (get 또는 update)');
    }
}

export async function updateJson(relativePath, newData) {
    try {
        const jsonPath = path.resolve(__dirname, relativePath); // 절대 경로 생성
        const jsonString = JSON.stringify(newData, null, 4); // JSON 데이터를 문자열로 변환 (4칸 들여쓰기)
        await fs.promises.writeFile(jsonPath, jsonString);; // 파일 쓰기
        console.log(`JSON file at ${relativePath} updated successfully.`);
    } catch (error) {
        console.error(`Error updating JSON file at ${relativePath}:`, error);
        throw error; // 에러를 호출한 쪽으로 전달
    }
}

export async function getJson(relativePath) {
    try {
        const jsonPath = path.resolve(__dirname, relativePath); // 절대 경로 생성
        const fileData = await fs.promises.readFile(jsonPath); // 파일 읽기
        return JSON.parse(fileData); // JSON 파싱 후 반환
    } catch (error) {
        console.error(`Error reading JSON file at ${relativePath}:`, error);
        throw error; // 에러를 호출한 쪽으로 전달
    }
}
