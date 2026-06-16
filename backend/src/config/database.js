import mysql from 'mysql2/promise';
import dns from 'dns';
import dotenv from 'dotenv';

dotenv.config();

// Render and other cloud hosts often fail on Hostinger IPv6 (ENETUNREACH); prefer IPv4
dns.setDefaultResultOrder('ipv4first');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'caza_buena',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
  charset: 'utf8mb4',
});

export default pool;
