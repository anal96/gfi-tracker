import mongoose from 'mongoose';

const batchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Batch name is required'],
    trim: true,
    unique: true
  },
  year: {
    type: String,
    required: true,
    default: new Date().getFullYear().toString()
  },
  description: {
    type: String,
    trim: true
  },
  students: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  teachers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
batchSchema.index({ name: 1, year: 1 });
batchSchema.index({ createdBy: 1 });

export default mongoose.model('Batch', batchSchema);
