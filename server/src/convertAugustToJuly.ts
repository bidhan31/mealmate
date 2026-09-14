import { connectDB, disconnectDB } from './config/db';
import mongoose from 'mongoose';

function convertValue(val: any): { updated: boolean; value: any } {
  if (val === null || val === undefined) {
    return { updated: false, value: val };
  }

  if (typeof val === 'string') {
    if (val.includes('2026-08') || val.includes('August') || val.includes('august') || val.includes('AUGUST')) {
      const newVal = val
        .replaceAll('2026-08', '2026-07')
        .replaceAll('August', 'July')
        .replaceAll('august', 'july')
        .replaceAll('AUGUST', 'JULY');
      return { updated: true, value: newVal };
    }
    return { updated: false, value: val };
  }

  if (typeof val !== 'object') {
    return { updated: false, value: val };
  }

  // Preserve BSON types like ObjectId, Date, Binary, etc.
  if (val instanceof Date || val instanceof mongoose.Types.ObjectId || (val && val._bsontype)) {
    return { updated: false, value: val };
  }

  if (Array.isArray(val)) {
    let arrUpdated = false;
    const newArr = val.map((item) => {
      const res = convertValue(item);
      if (res.updated) arrUpdated = true;
      return res.value;
    });
    return { updated: arrUpdated, value: arrUpdated ? newArr : val };
  }

  let objUpdated = false;
  const newObj: Record<string, any> = {};

  for (const [k, v] of Object.entries(val)) {
    const keyRes = convertValue(k);
    const valRes = convertValue(v);

    if (keyRes.updated || valRes.updated) {
      objUpdated = true;
    }
    newObj[keyRes.value as string] = valRes.value;
  }

  return { updated: objUpdated, value: objUpdated ? newObj : val };
}

async function convertDatabase() {
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection failed');
  }

  const collections = await db.listCollections().toArray();
  console.log('=== Starting Conversion from August (2026-08) to July (2026-07) ===');

  let totalUpdatedDocs = 0;

  for (const colInfo of collections) {
    const colName = colInfo.name;
    const col = db.collection(colName);
    const docs = await col.find({}).toArray();

    let colUpdated = 0;
    for (const doc of docs) {
      const res = convertValue(doc);
      if (res.updated) {
        await col.replaceOne({ _id: doc._id }, res.value);
        colUpdated++;
      }
    }

    if (colUpdated > 0) {
      console.log(`✅ Collection "${colName.padEnd(20)}": Updated ${colUpdated} documents.`);
      totalUpdatedDocs += colUpdated;
    } else if (docs.length > 0) {
      console.log(`ℹ️  Collection "${colName.padEnd(20)}": Checked ${docs.length} documents, none required modification.`);
    }
  }

  console.log(`\n🎉 Conversion complete! Total documents updated across database: ${totalUpdatedDocs}`);

  // Verify home currentCycle
  const homes = await db.collection('homes').find({}).toArray();
  for (const home of homes) {
    console.log(`Home "${home.name}" currentCycle is now: ${home.currentCycle}`);
  }

  await disconnectDB();
}

convertDatabase().catch((err) => {
  console.error('Conversion error:', err);
  process.exit(1);
});
