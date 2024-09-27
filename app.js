const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const winston = require('winston');
const expressWinston = require('express-winston');
const oracleDB = require('./utils/oracle');
const { sendSMS } = require('./utils/sms');

const app = express();
const port = process.env.PORT || 3000;

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

// Custom console transport for SMS logs only
const smsLogTransport = new winston.transports.Console({
  format: winston.format.simple(),
  level: 'info',
  // Only log messages that include "SMS sent" or "Failed to send SMS"
  log(info, callback) {
    if (info.message.includes('SMS sent') || info.message.includes('Failed to send SMS')) {
      console.log(info.message);
    }
    callback();
  }
});

logger.add(smsLogTransport);

// Middleware
app.use(helmet());
app.use(express.json());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Request logging (but not to console)
app.use(expressWinston.logger({
  winstonInstance: logger,
  meta: true,
  msg: "HTTP {{req.method}} {{req.url}}",
  expressFormat: true,
  colorize: false
}));

// Error logging (but not to console)
app.use(expressWinston.errorLogger({
  winstonInstance: logger
}));

// Function to check database connection
const checkDatabaseConnection = async () => {
  try {
    const isConnected = await oracleDB.testConnection();
    if (!isConnected) {
      throw new Error("Database connection failure");
    }
    return true;
  } catch (error) {
    logger.error('Database connection error:', error);
    return false;
  }
};

// Routes
app.post('/push', async (req, res, next) => {
  try {
    const results = await oracleDB.executeQuery(
      "SELECT phonenumber, employeeid FROM employee WHERE NVL(status,'N') = 'N'"
    );
    
    const updatedEmployees = await Promise.all(results.map(async (result) => {
      const { PHONENUMBER: phone, EMPLOYEEID: empid } = result;
      const message = `Status update: Your employee record (phone: ${phone}) will be marked as processed.`;
      
      try {
        // Send SMS first
        const smsSent = await sendSMS(phone, message);
        
        // Log SMS status
        if (smsSent) {
          logger.info(`SMS sent successfully to ${phone} for employee ID ${empid}`);
        } else {
          logger.info(`Failed to send SMS to ${phone} for employee ID ${empid}`);
        }
        
        // Only update the status if SMS was sent successfully
        let statusUpdated = false;
        if (smsSent) {
          const query = "UPDATE employee SET status = 'Y' WHERE employeeid = :empid";
          const updateResult = await oracleDB.executeQuery(query, [empid]);
          statusUpdated = updateResult.rowsAffected > 0;
        }
        
        return {
          employeeId: empid,
          phoneNumber: phone,
          smsSent,
          statusUpdated
        };
      } catch (error) {
        logger.error(`Error processing employee ID ${empid}:`, error);
        return {
          employeeId: empid,
          phoneNumber: phone,
          smsSent: false,
          statusUpdated: false,
          error: error.message
        };
      }
    }));

    const verifyResults = await oracleDB.executeQuery("SELECT COUNT(*) AS COUNT FROM employee WHERE status = 'Y'");
    const totalUpdated = verifyResults[0].COUNT;

    res.json({
      updatedEmployees,
      totalEmployeesWithStatusY: totalUpdated
    });

  } catch (error) {
    next(error);
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Server startup function
const startServer = async () => {
  try {

    const server = app.listen(port, () => {
      console.log(`SMS Service for Esopht Technologies running on http://localhost:${port}`);
    }).on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Error: Port ${port} is already in use. Close all applications and start this server again.`);
        process.exit(1);
      } else {
        console.error('An error occurred while starting the server:', error);
        process.exit(1);
      }
    });

    const dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
      console.error('Failed to connect to the database. Exiting...');
      process.exit(1);
    }

    

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        console.log('HTTP server closed');
        // Close database connection if needed
        // oracleDB.close();
      });
    });

  } catch (error) {
    console.error('An unexpected error occurred during server startup:', error);
    process.exit(1);
  }
};

// Start the server
startServer();