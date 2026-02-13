import mongoose from 'mongoose';

const unitLogSchema = new mongoose.Schema({
  unit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit',
    required: true
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    default: null
  },
  totalMinutes: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['not-started', 'in-progress', 'completed'],
    default: 'not-started',
    required: true
  }
}, {
  timestamps: true
});

// Calculate total minutes before saving if completed
unitLogSchema.pre('save', function(next) {
  if (this.status === 'completed' && this.endTime && this.startTime) {
    const diffMs = this.endTime - this.startTime;
    this.totalMinutes = Math.round(diffMs / (1000 * 60)); // Convert to minutes
  }
  next();
});

// Index for efficient queries
unitLogSchema.index({ teacher: 1, status: 1 });
unitLogSchema.index({ teacher: 1, createdAt: -1 });
// Unique compound index: one teacher can only have one active log per unit at a time
// This prevents duplicate logs for the same unit-teacher combination
unitLogSchema.index({ unit: 1, teacher: 1 }, { unique: true, sparse: true });

export default mongoose.model('UnitLog', unitLogSchema);
