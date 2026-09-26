import 'dotenv/config';

const rawMongoUri = process.env.MONGODB_URI;
if (!rawMongoUri) throw new Error('Missing required environment variable: MONGODB_URI');

const isPlaceholder = rawMongoUri.includes('<password>') || rawMongoUri.includes('<username>');

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT || 5000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  mongoUri: isPlaceholder ? 'mongodb://127.0.0.1:27017/poshanai' : rawMongoUri,
  isAtlasPlaceholder: isPlaceholder,
};
