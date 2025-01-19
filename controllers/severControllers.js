import { db } from '../firebase_admin.js';
import { controllVersionFile } from '../utils/file.js'
import { getJson } from '../utils/file.js'

export async function checkRunningServer(req, res) {
    const version = await controllVersionFile('get');
    res.status(200).send({ message: 'Server is running', version: version });
}

export async function getConstantsData(req, res) {
    try {
        const configDoc = await getJson('../json/config_constant.json');

        res.status(200).send({ message: 'Success get ConstantsData', data: configDoc });
    } catch (error) {
        console.error("Error getConstantsData:", error);
        // 에러 발생 시 500 응답
        res.status(500).json({ message: "Failed to fetch constants data", error: error.message });
    }
}

export async function getEventData(req, res) {
    try {
        const eventDoc = await getJson('../json/event.json');

        res.status(200).send({ message: 'Success get EventData', data: eventDoc });
    } catch (error) {
        console.error("Error getConstantsData:", error);
        // 에러 발생 시 500 응답
        res.status(500).json({ message: "Failed to fetch event data", error: error.message });
    }
}

export async function createEventData(req, res) {
    const { title, description, eventstart, eventend, multiplier, channel } = req.body;
    try {
        const newEvent = {
            eventstart,
            eventend,
            channel,
            multiplier,
            title,
            description,
        };

        // 진행 중인 이벤트에 추가
        await db.collection('config').doc('event').collection('upcoming').add(newEvent);

        res.status(200).send({ message: 'Success get EventData' });
    } catch (error) {
        console.error("Error createEventData:", error);
        // 에러 발생 시 500 응답
        res.status(500).json({ message: "Failed to fetch event data", error: error.message });
    }
}