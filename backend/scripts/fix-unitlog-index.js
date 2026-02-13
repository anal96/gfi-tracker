import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import UnitLog from '../models/UnitLog.js';

dotenv.config();

const fixUnitLogIndex = async () => {
  try {
    await connectDB();
    console.log('MongoDB connected for UnitLog index fix script');

    const db = mongoose.connection.db;
    const collection = db.collection('unitlogs');

    // List all indexes
    console.log('\n📋 Current indexes on unitlogs collection:');
    const indexes = await collection.indexes();
    indexes.forEach(index => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key));
    });

    // Drop old invalid indexes if they exist
    try {
      await collection.dropIndex('unitId_1_teacherId_1');
      console.log('\n✅ Dropped old index: unitId_1_teacherId_1');
    } catch (err) {
      if (err.code === 27 || err.codeName === 'IndexNotFound') {
        console.log('\nℹ️  Old index unitId_1_teacherId_1 does not exist (already removed)');
      } else {
        console.error('Error dropping old index:', err.message);
      }
    }

    // Clean up any invalid documents with null unit or teacher
    console.log('\n🧹 Cleaning up invalid documents...');
    const deleteResult = await UnitLog.deleteMany({
      $or: [
        { unit: null },
        { teacher: null }
      ]
    });
    console.log(`✅ Deleted ${deleteResult.deletedCount} invalid documents`);

    // Ensure the correct unique index exists (will be created automatically by Mongoose)
    // But we can also create it explicitly to ensure it's correct
    try {
      await collection.createIndex(
        { unit: 1, teacher: 1 },
        { 
          unique: true, 
          sparse: true,
          name: 'unit_1_teacher_1'
        }
      );
      console.log('\n✅ Created/updated correct unique index: unit_1_teacher_1');
    } catch (err) {
      if (err.code === 85 || err.codeName === 'IndexOptionsConflict') {
        console.log('\nℹ️  Index already exists, checking if it needs update...');
        // Index exists, that's fine
      } else {
        console.error('Error creating index:', err.message);
      }
    }

    // List indexes again to confirm
    console.log('\n📋 Updated indexes:');
    const updatedIndexes = await collection.indexes();
    updatedIndexes.forEach(index => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key));
    });

    console.log('\n✅ UnitLog index fix completed successfully!');
  } catch (error) {
    console.error('Error fixing UnitLog indexes:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nMongoDB disconnected.');
  }
};

fixUnitLogIndex();
