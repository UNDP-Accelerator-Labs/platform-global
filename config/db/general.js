exports.connection = {
  database: process.env.LOGIN_DB_NAME,
  port: process.env.LOGIN_DB_PORT,
  host: process.env.LOGIN_DB_HOST,
  user: process.env.LOGIN_DB_USERNAME,
  password: process.env.LOGIN_DB_PASSWORD,
  ssl: ['production', 'local-production'].includes(process.env.NODE_ENV),
};
