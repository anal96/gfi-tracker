import mongoose from 'mongoose';

const approvalSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['unit-complete', 'time-slot', 'subject-assign', 'unit-start', 'break-timing'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    required: true
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // Request data - varies by type
  requestData: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  // Original data before approval (for rollback if needed)
  originalData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  // Rejection reason
  rejectionReason: {
    type: String,
    default: null
  },
  // Timestamps
  approvedAt: {
    type: Date,
    default: null
  },
  rejectedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
approvalSchema.index({ status: 1, createdAt: -1 });
approvalSchema.index({ requestedBy: 1, status: 1 });
approvalSchema.index({ type: 1, status: 1 });

export default mongoose.model('Approval', approvalSchema);
