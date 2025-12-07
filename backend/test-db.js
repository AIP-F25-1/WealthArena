// Quick database connection test
require('dotenv').config();
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_HOST,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || '1433'),
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: false,
    enableArithAbort: true,
    connectTimeout: 30000,
  },
};

console.log('Testing database connection...');
console.log('Server:', config.server);
console.log('Database:', config.database);
console.log('User:', config.user);

sql.connect(config)
  .then(pool => {
    console.log('✅ Connected to Azure SQL Database successfully!');
    return pool.query('SELECT @@VERSION AS Version');
  })
  .then(result => {
    console.log('Database version:', result.recordset[0].Version);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err.message);
    console.error('Full error:', err);
    process.exit(1);
  });

