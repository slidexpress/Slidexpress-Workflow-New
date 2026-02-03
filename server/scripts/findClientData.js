require('dotenv').config();
const mongoose = require('mongoose');

async function findClientData() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/slidexpress');

  // List all collections
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('All collections in database:');

  for (const col of collections) {
    const count = await mongoose.connection.db.collection(col.name).countDocuments();
    console.log(`  - ${col.name}: ${count} documents`);

    // Show sample document structure
    if (count > 0) {
      const sample = await mongoose.connection.db.collection(col.name).findOne();
      console.log(`    Fields: ${Object.keys(sample).join(', ')}`);
    }
  }

  // Check for any collection with "client" in the name
  const clientCollections = collections.filter(c =>
    c.name.toLowerCase().includes('client')
  );

  if (clientCollections.length > 0) {
    console.log('\n--- Client-related collections ---');
    for (const col of clientCollections) {
      const docs = await mongoose.connection.db.collection(col.name).find({}).limit(5).toArray();
      console.log(`\n${col.name} (sample data):`);
      docs.forEach(d => console.log(JSON.stringify(d, null, 2)));
    }
  }

  await mongoose.disconnect();
}

findClientData().catch(console.error);
