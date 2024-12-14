import { createUserWithEmailAndPassword, signInWithEmailAndPassword, getAuth, sendPasswordResetEmail, updatePassword, sendEmailVerification, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { auth, firebaseConfig } from '../firebase.js';
import { admin, db } from '../firebase_admin.js';
import { getDate } from '../utils/date.js'
import axios from 'axios';


// 회원가입 기능
export async function signUpUser(req, res) {
    const { email, password } = req.body;

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        res.status(201).json({ message: 'User signed up successfully', user: userCredential.user });
    } catch (error) {
        console.error('Error signing up:', error.message);
        res.status(400).json({ message: 'Failed to sign up', error: error.message });
    }
}

// 로그인 기능
export async function signInUser(req, res) {
    const { email, password } = req.body;
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);

        const authState = await checkSignUp(userCredential.user.uid);

        res.status(201).json({ message: 'User signed in', user: userCredential.user, state: authState });
    } catch (error) {
        console.error('Error signing in:', error.message);
        res.status(400).json({ message: 'Failed to sign in', error: error.message });
    }
}

// 비밀번호 찾기
export async function resetPassword(req, res) {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: "Email is required" });
    }

    const auth = getAuth();
    try {
        await sendPasswordResetEmail(auth, email);
        res.status(200).json({ message: `Password reset email sent to ${email}` });
    } catch (error) {
        console.error("Error sending password reset email:", error);
        res.status(500).json({ message: "Failed to send password reset email", error: error.message });
    }
}

// 비밀번호 변경
export async function changePassword(req, res) {
    const { uid, newPassword } = req.body;

    if (!uid || !newPassword) {
        return res.status(400).json({ message: 'UID and new password are required' });
    }

    try {
        await admin.auth().updateUser(uid, {
            password: newPassword,
        });
        res.status(200).json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Error updating password:', error);
        res.status(500).json({ message: 'Failed to update password', error: error.message });
    }
}

// 이메일 인증
export async function sendEmail(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        // 사용자를 로그인하여 사용자 객체를 가져옴
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 이메일 인증 링크 전송
        if (!user.emailVerified) {
            await sendEmailVerification(user);
            res.status(200).json({ message: `Verification email sent to ${email}` });
        } else {
            res.status(200).json({ message: 'Email is already verified' });
        }
    } catch (error) {
        console.error('Error sending verification email:', error);
        res.status(500).json({ message: 'Failed to send verification email', error: error.message });
    }
}

// 이메일 인증상태 확인
export async function checkEmail(req, res) {
    const { uid } = req.body;

    if (!uid) {
        return res.status(400).json({ message: 'UID is required' });
    }

    try {
        // Firebase Admin SDK를 사용하여 사용자 정보 가져오기
        const userRecord = await admin.auth().getUser(uid);

        // 이메일 인증 상태 확인
        if (userRecord.emailVerified) {
            res.status(200).json({ emailVerified: true, message: 'Email is verified' });
        } else {
            res.status(200).json({ emailVerified: false, message: 'Email is not verified' });
        }
    } catch (error) {
        console.error('Error verifying email status:', error);
        res.status(500).json({ message: 'Failed to verify email status', error: error.message });
    }
}

export async function deleteUserAuth(req, res) {
    const { uid, name } = req.body;

    try {
        const nameDocRef = db.collection('delete').doc(getDate());

        // 해당 문서가 존재하는지 확인
        const nameDocSnap = await nameDocRef.get();

        if (nameDocSnap.exists) {
            await admin.auth().deleteUser(uid);

            // 문서가 존재할 경우 데이터 가져오기
            let uidList = nameDocSnap.data().uidlist || [];
            let nameList = nameDocSnap.data().namelist || []; // namelist 추가

            // `uid`가 리스트에 없으면 추가
            if (!uidList.includes(uid)) {
                uidList.push(uid);
            }

            // `name`이 리스트에 없으면 추가
            if (!nameList.includes(name)) {
                nameList.push(name);
            }

            // Firestore에 리스트 업데이트
            await nameDocRef.update({
                uidlist: uidList,
                namelist: nameList, // namelist 업데이트
            });
        } else {
            // 문서가 존재하지 않을 경우 새로 생성
            await nameDocRef.set({
                uidlist: [uid],
                namelist: [name], // namelist 생성
            });
        }

        res.status(200).json({ message: `User with UID ${uid} and name ${name} deleted successfully from Authentication` });
    } catch (error) {
        console.error('Error deleting user from Authentication:', error);
        res.status(500).json({ message: 'Failed to delete user from Authentication', error: error.message });
    }
}

export async function tokenLogin(req, res) {
    const { idToken, refreshToken } = req.body;

    try {
        let token = idToken;
        let loginData;

        // ID Token이 없으면 Refresh Token을 사용해 새로 발급
        if (!idToken && refreshToken) {
            token = await getIdToken(refreshToken);
        }

        // Token 검증 시도
        loginData = await tryLogin(token);

        if (loginData) {
            // 검증 성공 시 사용자 정보 반환
            return res.status(200).json({
                message: 'Login successful',
                uid: loginData.uid,
                idToken: loginData.idToken,
            });
        } else {
            token = await getIdToken(refreshToken);
            loginData = await tryLogin(token);
            if (loginData) {
                // 검증 성공 시 사용자 정보 반환
                return res.status(200).json({
                    message: 'Login successful',
                    uid: loginData.uid,
                    idToken: loginData.idToken,
                });
            } else {
                return res.status(401).json({ message: 'Invalid ID Token' });
            }
        }
    } catch (error) {
        console.error('tokenLogin Error during login:', error);
        res.status(500).json({ message: 'Failed to login', error: error.message });
    }
}

// Firebase ID Token 검증 함수
async function tryLogin(idToken) {
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;
        return {
            uid: uid,
            idToken: idToken,
        };
    } catch (error) {
        //console.error('tryLogin Failed to verify ID Token:', error);
        return null;
    }
}

// Refresh Token을 사용해 새로운 ID Token 발급 함수
async function getIdToken(refreshToken) {
    if (!refreshToken) {
        throw new Error('Refresh token is required.');
    }
    try {
        const API_KEY = firebaseConfig.apiKey;
        const response = await axios.post(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`, {
            grant_type: 'refresh_token',
            refresh_token: refreshToken
        });

        const { id_token } = response.data;
        return id_token;
    } catch (error) {
        console.error('getIdToken Failed to refresh token:', error.response?.data || error.message);
        throw new Error('Failed to refresh token');
    }
}

async function deleteQueryBatch(db, query, resolve, reject) {
    try {
        const snapshot = await query.get();

        if (snapshot.size === 0) {
            resolve();
            return;
        }

        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        process.nextTick(() => {
            deleteQueryBatch(db, query, resolve, reject);
        });
    } catch (error) {
        reject(error);
    }
}

async function checkSignUp(uid) {
    try {
        // Firestore에서 user 문서 가져오기
        const userDoc = await db.collection('users').doc(uid).get();

        // 문서 존재 여부 확인
        if (!userDoc.exists) {
            console.log(`User with UID ${uid} does not exist.`);
            // 문서가 존재하지 않을경우 0
            return 0;
        }

        // 문서 데이터 가져오기
        const userData = userDoc.data();

        // 필드 값 확인
        const idField = userData.id || '';
        const nameFieldExists = 'name' in userData;

        // 조건 확인
        const isEmail = idField.includes('@'); // id에 @ 포함 여부 확인
        const hasName = nameFieldExists; // name 필드 존재 여부

        // 회원가입 4단계를 하지 않은 계정일떄 게스트 아이디 일경우 1 반환, 이메일 아이디 일경우 2반환 회원가입을 완료한 계정일경우 3반환
        if (!hasName) {
            if (isEmail) {
                return 'checkemail';
            } else {
                return 'setdata';
            }
        } else {
            return '';
        }
    } catch (error) {
        console.error('Error checking user sign-up status:', error);
        throw error; // 에러를 호출자에게 전달
    }
}