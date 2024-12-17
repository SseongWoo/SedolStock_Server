import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// 현재 파일의 디렉터리 이름을 얻기
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function controllVersionFile(type, versionCode, versionName) {
    const jsonPath = path.resolve(__dirname, '../version.json');

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
