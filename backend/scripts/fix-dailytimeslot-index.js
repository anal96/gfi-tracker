// Script to fix DailyTimeSlot collection index issues
// Run with: node scripts/fix-dailytimeslot-index.js

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import DailyTimeSlot from '../models/DailyTimeSlot.js';

dotenv.config();

const fixDailyTimeSlotIndex = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gfi-tracker');
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('dailytimeslots');

    // List all indexes
    console.log('\n📋 Current indexes on dailytimeslots collection:');
    const indexes = await collection.indexes();
    indexes.forEach(index => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key));
    });

    // Drop old invalid indexes if they exist
    const oldIndexes = [
      'teacherId_1_date_1_slotId_1',
      'teacherId_1_date_1',
      'teacher_1_date_1_slotId_1',
      'teacherId_1_date_1_slotLabel_1'
    ];

    for (const indexName of oldIndexes) {
      try {
        await collection.dropIndex(indexName);
        console.log(`\n✅ Dropped old index: ${indexName}`);
      } catch (err) {
        if (err.code === 27 || err.codeName === 'IndexNotFound') {
          console.log(`\nℹ️  Old index ${indexName} does not exist (already removed)`);
        } else {
          console.error(`Error dropping old index ${indexName}:`, err.message);
        }
      }
    }

    // Clean up any invalid documents with null teacher values
    console.log('\n🧹 Cleaning up invalid documents...');
    const deleteResult = await DailyTimeSlot.deleteMany({
      teacher: null
    });
    console.log(`✅ Deleted ${deleteResult.deletedCount} invalid documents with null teacher`);

    // Also clean up any documents that might have been created with wrong field names
    try {
      const deleteResult2 = await collection.deleteMany({
        teacherId: { $exists: true }
      });
      console.log(`✅ Deleted ${deleteResult2.deletedCount} documents with old 'teacherId' field`);
    } catch (err) {
      console.log('ℹ️  No documents with old teacherId field found');
    }

    // Ensure the correct unique index exists
    try {
      await collection.createIndex(
        { teacher: 1, date: 1 },
        { 
          unique: true,
          name: 'teacher_1_date_1'
        }
      );
      console.log('\n✅ Created/updated correct unique index: teacher_1_date_1');
    } catch (err) {
      if (err.code === 85 || err.codeName === 'IndexOptionsConflict') {
        console.log('\nℹ️  Index already exists with different options, dropping and recreating...');
        try {
          await collection.dropIndex('teacher_1_date_1');
          await collection.createIndex(
            { teacher: 1, date: 1 },
            { 
              unique: true,
              name: 'teacher_1_date_1'
            }
          );
          console.log('✅ Recreated index with correct options');
        } catch (err2) {
          console.error('Error recreating index:', err2.message);
        }
      } else if (err.code === 11000 || err.codeName === 'DuplicateKey') {
        console.log('\n⚠️  Duplicate documents found. Cleaning up duplicates...');
        // Find and remove duplicates, keeping the most recent one
        const duplicates = await DailyTimeSlot.aggregate([
          {
            $match: {
              teacher: { $ne: null }
            }
          },
          {
            $group: {
              _id: { teacher: '$teacher', date: '$date' },
              ids: { $push: '$_id' },
              count: { $sum: 1 }
            }
          },
          {
            $match: {
              count: { $gt: 1 }
            }
          }
        ]);

        for (const dup of duplicates) {
          // Keep the most recent one, delete the rest
          const ids = dup.ids;
          const docs = await DailyTimeSlot.find({ _id: { $in: ids } }).sort({ createdAt: -1 });
          if (docs.length > 1) {
            const toDelete = docs.slice(1);
            const deleteIds = toDelete.map(d => d._id);
            await DailyTimeSlot.deleteMany({ _id: { $in: deleteIds } });
            console.log(`  ✅ Removed ${deleteIds.length} duplicate(s) for teacher ${dup._id.teacher}, date ${dup._id.date}`);
          }
        }

        // Try creating index again
        try {
          await collection.createIndex(
            { teacher: 1, date: 1 },
            { 
              unique: true,
              name: 'teacher_1_date_1'
            }
          );
          console.log('✅ Created index after cleaning duplicates');
        } catch (err3) {
          console.error('Error creating index after cleanup:', err3.message);
        }
      } else {
        console.error('Error creating index:', err.message);
      }
    }

    // List indexes again to confirm
    console.log('\n📋 Updated indexes:');
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach(index => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key));
    });

    console.log('\n✅ DailyTimeSlot index fix completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

fixDailyTimeSlotIndex();
