const oracleDB = require('./oracle');
const { sendSMS } = require('./sms');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  try {
    console.log("SMS Service for Esopht Technologies");
    console.log("====================================");
    
    // Check database connection with visual indicator
    const isConnected = await oracleDB.testConnection();
    if (!isConnected) {
      console.log("Exiting due to database connection failure.");
      return;
    }

    const results = await oracleDB.executeQuery("SELECT phonenumber,employeeid FROM employee WHERE NVL(status,'N') = 'N' and employeeid = '1' ");
    console.log('Employees to update:', results);
    
    for (const result of results) {
      let phone = result.PHONENUMBER;
      let empid = result.EMPLOYEEID;
      let query = "UPDATE employee SET status = 'Y' WHERE employeeid = :empid";
      
      try {
        const updateResult = await oracleDB.executeQuery(query, [empid]);
        console.log(`Updated status for employee ID ${empid}. Rows affected: ${updateResult.rowsAffected}`);
        
        // Send SMS
        const message = `Your employee status has been updated. Employee ID: ${empid}`;
        const smsSent = await sendSMS(phone, message);
        if (smsSent) {
          console.log(`SMS sent successfully to ${phone}`);
        } else {
          console.log(`Failed to send SMS to ${phone}`);
        }
      } catch (updateError) {
        console.error(`Error updating status for employee ID ${empid}:`, updateError);
      }
    }

    // Verify the updates
    const verifyResults = await oracleDB.executeQuery("SELECT COUNT(*) AS COUNT FROM employee WHERE status = 'Y'");
    console.log('Number of employees with status Y:', verifyResults[0].COUNT);

  } catch (error) {
    console.error('Error in main:', error);
  } finally {
    await askQuestion("Press Enter to exit...");
    rl.close();
  }
}

main();