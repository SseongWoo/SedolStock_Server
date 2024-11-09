export function getTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    return `${year}-${month}-${day} ${hours}_${minutes}_${seconds}`;
}

export function newGetTime() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}_${minutes}`;
}

export function getDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    return `${year}-${month}-${day}`;
}

export function getDayName() {
    const daysOfWeek = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

    // 현재 날짜 객체 생성
    const today = new Date();

    // getDay() 메서드는 현재 요일을 숫자로 반환 (0부터 6까지)
    const dayName = daysOfWeek[today.getDay()];

    return `${dayName}`;
}