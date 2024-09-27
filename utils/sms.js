const axios = require('axios');

async function sendSMS(phoneNumber, message) {
    const username = "esopht";
    const password = "youroge1968";
    const sender_id = "esopht";
    const url = "https://sms.nalosolutions.com/smsbackend/clientapi/Resl_Nalo/send-message/";

    const body = {
        msisdn: phoneNumber,
        sender_id: sender_id,
        message: message,
        username: username,
        password: password
    };

    try {
        const response = await axios.post(url, body, {
            headers: {
                'Content-Type': 'application/json',
            }
        });
        if (response.status === 200) {
            // console.log('SMS sent successfully');
            return true;
        } else {
            console.error('Failed to send SMS:', response.data);
            return false;
        }
    } catch (error) {
        console.error('An error occurred while sending the SMS:', error.message);
        return false;
    }
}
// sendSMS("0557605827","hi").then((res)=>console.log(res)).catch((err)=>console.log(err))
module.exports = {
    sendSMS
};