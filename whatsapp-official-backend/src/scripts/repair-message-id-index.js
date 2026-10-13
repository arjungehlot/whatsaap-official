const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const INDEX_NAME = 'account_id_1_message_id_1';
const INDEX_KEY = { account_id: 1, message_id: 1 };
const INDEX_OPTIONS = {
  name: INDEX_NAME,
  unique: true,
  partialFilterExpression: { message_id: { $type: 'string' } },
};

function isCorrectIndex(index) {
  return (
    index?.unique === true &&
    JSON.stringify(index.key) === JSON.stringify(INDEX_KEY) &&
    index.partialFilterExpression?.message_id?.$type === 'string'
  );
}

async function run() {
  if (!process.env.MONGODB_URI)
    throw new Error('MONGODB_URI must be configured.');

  await mongoose.connect(process.env.MONGODB_URI);
  const collection = mongoose.connection.collection('messages');
  const indexes = await collection.indexes();
  const existing = indexes.find((index) => index.name === INDEX_NAME);

  if (isCorrectIndex(existing)) {
    console.log(`Message id index is already correct: ${INDEX_NAME}`);
    return;
  }

  if (existing) {
    await collection.dropIndex(INDEX_NAME);
    console.log(`Removed legacy ${INDEX_NAME} index.`);
  }

  await collection.createIndex(INDEX_KEY, INDEX_OPTIONS);
  console.log(`Created partial unique ${INDEX_NAME} index.`);
}

run()
  .catch((error) => {
    console.error('Unable to repair message id index:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
