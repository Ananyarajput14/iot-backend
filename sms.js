require("dotenv").config();
const twilio = require("twilio");

const client = twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_AUTH
);

const sendSMS = async (message) => {
  try {
    const response = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE, // Twilio number
      to: process.env.ALERT_PHONE     // Your phone number
    });

    console.log("SMS Sent:", response.sid);
  } catch (error) {
    console.error("SMS Failed:", error.message);
  }
};

module.exports = sendSMS;