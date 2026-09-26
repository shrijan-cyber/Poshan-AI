const DEFAULT_PROVIDER = 'chroma';

export const createVectorStore = ({
  provider = process.env.VECTOR_DB_PROVIDER || DEFAULT_PROVIDER,
  collection = process.env.VECTOR_DB_COLLECTION || 'ifct-2017',
  chromaUrl = process.env.CHROMA_URL,
  pineconeIndexHost = process.env.PINECONE_INDEX_HOST,
  pineconeApiKey = process.env.PINECONE_API_KEY,
} = {}) => {
  const selectedProvider = provider.toLowerCase();
  if (!['chroma', 'pinecone'].includes(selectedProvider)) {
    throw new TypeError('VECTOR_DB_PROVIDER must be either "chroma" or "pinecone".');
  }
  if (!collection.trim()) throw new TypeError('Vector database collection name cannot be empty.');
  if (selectedProvider === 'chroma' && !chromaUrl) throw new Error('CHROMA_URL is required for the Chroma vector database.');
  if (selectedProvider === 'pinecone' && (!pineconeIndexHost || !pineconeApiKey)) {
    throw new Error('PINECONE_INDEX_HOST and PINECONE_API_KEY are required for Pinecone.');
  }

  return Object.freeze({
    provider: selectedProvider,
    collection,
    chromaUrl: chromaUrl?.replace(/\/$/, ''),
    pineconeIndexHost: pineconeIndexHost?.replace(/\/$/, ''),
    pineconeApiKey,
  });
};

export const upsertIfctRecords = async (_store, _records) => {
  throw new Error('IFCT vector upsert is not implemented yet. TODO: add provider-specific upsert after selecting the deployment and metadata schema.');
};

export const queryIfctRecords = async (_store, _embedding, _options = {}) => {
  throw new Error('IFCT vector search is not implemented yet. TODO: return verified IFCT records only and enforce metadata filters.');
};

export const checkVectorStoreConnection = async (_store) => {
  throw new Error('Vector store health checks are not implemented yet. TODO: add provider-specific collection/index checks.');
};
