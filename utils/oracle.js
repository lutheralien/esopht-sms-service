const oracledb = require('oracledb');

const config = {
  user: 'HOMECARE',
  password: 'HOMECARE',
  connectString: '192.168.1.35:1521/SUPPORT_PDB'
};

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createAnimationController() {
  let intervalId = null;
  return {
    start: (frames, interval) => {
      let i = 0;
      intervalId = setInterval(() => {
        process.stdout.write(`\rAttempting to connect to database... ${frames[i++ % frames.length]}`);
      }, interval);
    },
    stop: () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
      }
    }
  };
}

async function getConnection() {
  try {
    const connection = await oracledb.getConnection(config);
    return connection;
  } catch (error) {
    throw error;
  }
}

async function executeQuery(query, params = []) {
  let connection;
  try {
    connection = await getConnection();
    const options = {
      autoCommit: false,
      outFormat: oracledb.OUT_FORMAT_OBJECT
    };
    const result = await connection.execute(query, params, options);
    
    await connection.commit();
    
    return result.rows || { rowsAffected: result.rowsAffected };
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
        console.log('Transaction rolled back');
      } catch (rollbackError) {
        console.error('Error rolling back transaction:', rollbackError);
      }
    }
    throw error;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (error) {
        console.error('Error closing connection:', error);
      }
    }
  }
}

async function testConnection() {
  let connection;
  const animationController = createAnimationController();
  try {
    animationController.start(['-', '\\', '|', '/'], 100);
    connection = await getConnection();
    animationController.stop();
    console.log('\x1b[32m✔\x1b[0m Connected to Oracle database');
    return true;
  } catch (error) {
    animationController.stop();
    console.log('\x1b[31m✘\x1b[0m Failed to connect to Oracle database');
    console.error('Error details:', error.message);
    return false;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (error) {
        console.error('Error closing connection:', error);
      }
    }
  }
}

module.exports = {
  executeQuery,
  testConnection
};