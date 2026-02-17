import mongoose from 'mongoose';

const timeTableHistorySchema = new mongoose.Schema({
  verifier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  entries: [{
    type: mongoose.Schema.Types.Mixed // Stores the raw JSON entries for re-generation of Excel
  }],
  teacherEmails: [{
    type: String
  }],
  teacherNames: [{
    type: String
  }],
  batchNames: [{
    type: String // For quick reference
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('TimeTableHistory', timeTableHistorySchema);
