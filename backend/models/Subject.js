import mongoose from 'mongoose';

const subjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Subject name is required'],
    trim: true
  },
  color: {
    type: String,
    required: true,
    default: 'from-blue-500 to-indigo-500'
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  units: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit'
  }],
  batch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch'
  }
}, {
  timestamps: true
});

export default mongoose.model('Subject', subjectSchema);
