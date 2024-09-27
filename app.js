const winston = require('winston');
const oracleDB = require('./utils/oracle');
const { sendSMS } = require('./utils/sms');
const readline = require('readline');

// Logging configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

async function push() {
  try {
    const isConnected = await oracleDB.testConnection();
    if (!isConnected) {
      throw new Error("Database connection failure");
    }

    const results = await oracleDB.executeQuery("SELECT Customer_Number, SMS_Message, PHONE_NUMBER FROM TBSMG_SMS_MESSAGE WHERE NVL(status,'N') = 'N'");
     await Promise.all(results.map(async (result) => {
      const { PHONE_NUMBER: phone, CUSTOMER_NUMBER: custNo, SMS_MESSAGE: message } = result;
      try {
        // Send SMS first
        const smsSent = await sendSMS(phone, message);
        
        if (smsSent) {
          console.log(`SMS sent successfully for customer with phone ${phone} and customerNumber ${custNo}`);
          const query = "INSERT INTO TBSMG_SENT_MESSAGES SELECT * FROM TBSMG_SMS_MESSAGE WHERE Customer_Number = :custNo AND PHONE_NUMBER = : phone";
          const updateResult = await oracleDB.executeQuery(query, [phone,custNo]);
          return {
             phone,
            smsSent: true,
            custNo
          };
        } else {
          logger.warn(`SMS sending failed for customer with phone ${phone}.`);
          return {
            phone,
            smsSent: true,
            custNo
          };
        }
      } catch (error) {
        logger.error(`Error processing Phone ${phone}:`, error);
        logger.warn(`SMS sending failed for customer with phone ${phone}.`);
          return {
            phone,
            smsSent: true,
            custNo
          };
      }
    }));
    logger.info('process completed');
  } catch (error) {
    logger.error('An error occurred:', error);
    console.error('An error occurred:', error);
  } finally {
    // Close database connection if needed
    // await oracleDB.close();
    
    // Keep console open
    keepConsoleOpen();
  }
}

function keepConsoleOpen() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Press Enter to exit...', () => {
    rl.close();
    process.exit(0);
  });
}

// Run the script
push();