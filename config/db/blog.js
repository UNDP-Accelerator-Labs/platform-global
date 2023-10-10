const isProd = ['production', 'local-production'].includes(
  process.env.NODE_ENV,
);

exports.connection = {
  database: process.env.BLOG_DB_NAME,
  port: process.env.LOGIN_DB_PORT,
  host: process.env.BLOG_DB_HOST,
  user: process.env.BLOG_DB_USERNAME,
  password: process.env.BLOG_DB_PASSWORD,
  ssl: isProd,
};
