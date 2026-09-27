import 'dotenv/config';

const rawMongoUri = process.env.MONGODB_URI;
if (!rawMongoUri) throw new Error('Missing required environment variable: MONGODB_URI');

const isPlaceholder = /<\s*(?:password|username)\s*>/i.test(rawMongoUri);
const port = Number(process.env.PORT || 5000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port,
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  mongoUri: isPlaceholder ? 'mongodb://127.0.0.1:27017/poshanai' : rawMongoUri,
  isAtlasPlaceholder: isPlaceholder,
};
