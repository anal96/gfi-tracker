
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load models
import Approval from '../models/Approval.js';
import UnitLog from '../models/UnitLog.js';

// Setup environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gfi-tracker';
    console.log(`Connecting to MongoDB at ${uri}...`);
    await mongoose.connect(uri);
    console.log('MongoDB Connected');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

const cleanupPendingUnits = async () => {
  await connectDB();

  try {
    console.log('🔍 Searching for pending unit-start and unit-complete approvals...');

    const pendingApprovals = await Approval.find({
      type: { $in: ['unit-start', 'unit-complete'] },
      status: 'pending'
    });

    console.log(`Found ${pendingApprovals.length} pending approvals to process.`);

    for (const approval of pendingApprovals) {
      console.log(`Processing approval ${approval._id} (${approval.type})...`);
      
      const teacherId = approval.requestedBy;
      
      if (approval.type === 'unit-start') {
        const { unitId, subjectId } = approval.requestData;
        
        // Find or create UnitLog
        let unitLog = await UnitLog.findOne({
          unit: unitId,
          teacher: teacherId
        });

        if (unitLog) {
            // Update existing log to in-progress
            unitLog.status = 'in-progress';
            unitLog.startTime = new Date(); // Reset start time to now, or keep original? Keeping original might be better but user wants "current" requests gone. Let's restart it to be safe.
            unitLog.endTime = null;
            await unitLog.save();
            console.log(`  - Updated UnitLog ${unitLog._id} to in-progress`);
        } else {
            // Create new
            unitLog = await UnitLog.create({
                unit: unitId,
                teacher: teacherId,
                subject: subjectId,
                startTime: new Date(),
                status: 'in-progress',
                endTime: null,
                totalMinutes: 0
            });
            console.log(`  - Created new UnitLog ${unitLog._id}`);
        }
      } else if (approval.type === 'unit-complete') {
        const { unitLogId } = approval.requestData;
        const unitLog = await UnitLog.findById(unitLogId);
        
        if (unitLog) {
            unitLog.status = 'completed';
            unitLog.endTime = new Date();
            await unitLog.save();
            console.log(`  - Updated UnitLog ${unitLog._id} to completed`);
        } else {
            console.log(`  - UnitLog ${unitLogId} not found, skipping log update.`);
        }
      }

      // Mark approval as approved (auto-approved)
      approval.status = 'approved';
      approval.approvedBy = teacherId; // Auto-approved by self/system
      approval.approvedAt = new Date();
      await approval.save();
      console.log(`  - Marked approval ${approval._id} as approved`);
    }

    console.log('✅ Cleanup complete!');
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
};

cleanupPendingUnits();
