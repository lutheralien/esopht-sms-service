const axios = require('axios');

async function sendSMS(phoneNumber, message) {
    const key = 'dDaK07CbVFx1C3oQ12JcLlxcp';
    const sender_id = 'esopht';
    const url = 'https://apps.mnotify.net/smsapi';

    const params = new URLSearchParams({
        key,
        to: phoneNumber,
        msg: message,
        sender_id
    });

    try {
        const response = await axios.get(`${url}?${params.toString()}`);
        if (response.data.status === 'success' && response.data.code === '1000') {
            console.log('SMS sent successfully:', response.data.message);
            return true;
        } else {
            console.error('Failed to send SMS:', (response.data.message || "Invalid Number"));
            return false;
        }
    } catch (error) {
        console.error('An error occurred while sending the SMS:', error.message);
        return false;
    }
}

// Example usage:
// sendSMS("1550748724", "Your OTP is 1").then(res => console.log(res)).catch(err => console.log(err));

module.exports = {
    sendSMS
};