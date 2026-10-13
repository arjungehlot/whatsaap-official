// Moves legacy documents from the old `records` collection into real MongoDB
// collections. It is idempotent and only deletes the legacy copies after all
// destination writes succeed.
require('dotenv').config();
const mongoose = require('mongoose');
const { Record } = require('../models');
const { COLLECTIONS } = require('../config/constants');
const { getCollectionModel } = require('../models/collection.factory');
const execute = process.argv.includes('--execute');
async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  await mongoose.connect(process.env.MONGODB_URI);
  const legacy = await Record.find({}).lean();
  const valid = legacy.filter((item) => COLLECTIONS.includes(item.collection));
  const invalid = legacy.length - valid.length;
  console.log(
    JSON.stringify(
      {
        mode: execute ? 'EXECUTE' : 'DRY RUN',
        legacyRecords: legacy.length,
        validRecords: valid.length,
        invalidRecords: invalid,
      },
      null,
      2
    )
  );
  if (!execute) return;
  const groups = new Map();
  for (const item of valid) {
    const copy = { ...item };
    delete copy._id;
    delete copy.collection;
    delete copy.__v;
    const list = groups.get(item.collection) || [];
    list.push({
      updateOne: {
        filter: { id: copy.id },
        update: { $set: copy },
        upsert: true,
      },
    });
    groups.set(item.collection, list);
  }
  for (const [collection, writes] of groups)
    await getCollectionModel(collection).bulkWrite(writes, { ordered: false });
  const verified = await Promise.all(
    [...groups].map(async ([collection, writes]) => ({
      collection,
      expected: writes.length,
      actual: await getCollectionModel(collection).countDocuments({
        id: { $in: writes.map((write) => write.updateOne.filter.id) },
      }),
    }))
  );
  const failures = verified.filter(
    (result) => result.actual !== result.expected
  );
  if (failures.length)
    throw new Error(`Verification failed: ${JSON.stringify(failures)}`);
  await Record.deleteMany({});
  console.log(
    JSON.stringify(
      {
        moved: valid.length,
        collections: verified.map((result) => result.collection),
        legacyRecordsRemoved: true,
      },
      null,
      2
    )
  );
  await mongoose.disconnect();
}
main().catch(async (error) => {
  console.error(`Normalization failed: ${error.message}`);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
