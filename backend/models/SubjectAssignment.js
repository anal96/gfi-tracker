import mongoose from 'mongoose';

const subjectAssignmentSchema = new mongoose.Schema({
  // Original teacher who has the subject
  fromTeacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  // New teacher who will take over
  toTeacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Subject being assigned
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true
  },
  // Batch (optional) – for filtering/display
  batch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch'
  },
  // Remaining units to complete (units not yet completed)
  remainingUnits: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit'
  }],
  // Reason for assignment (leave, emergency, etc.)
  reason: {
    type: String,
    required: true
  },
  // Status: pending = waiting admin, admin_approved = waiting teacher, approved = done, rejected = by admin or teacher
  status: {
    type: String,
    enum: ['pending', 'admin_approved', 'approved', 'rejected'],
    default: 'pending',
    required: true
  },
  // Requested by verifier
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Approved/rejected by admin
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Rejection reason
  rejectionReason: {
    type: String
  },
  // Timestamps
  approvedAt: {
    type: Date
  },
  rejectedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
subjectAssignmentSchema.index({ status: 1, createdAt: -1 });
subjectAssignmentSchema.index({ fromTeacher: 1, status: 1 });
subjectAssignmentSchema.index({ toTeacher: 1, status: 1 });
subjectAssignmentSchema.index({ subject: 1, status: 1 });

export default mongoose.model('SubjectAssignment', subjectAssignmentSchema);
