import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

function readCloudinaryEnv() {
  return {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim() || '',
    api_key: process.env.CLOUDINARY_API_KEY?.trim() || '',
    api_secret: process.env.CLOUDINARY_API_SECRET?.trim() || '',
  };
}

export const isCloudinaryConfigured = () => {
  const { cloud_name, api_key, api_secret } = readCloudinaryEnv();
  return Boolean(cloud_name && api_key && api_secret);
};

const creds = readCloudinaryEnv();
if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: creds.cloud_name,
    api_key: creds.api_key,
    api_secret: creds.api_secret,
  });
}

export default cloudinary;
