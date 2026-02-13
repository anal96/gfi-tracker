import mongoose from 'mongoose';

const dailyTimeSlotSchema = new mongoose.Schema({
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  slots: [{
    slotId: {
      type: String,
      required: true
    },
    label: {
      type: String,
      required: true
    },
    duration: {
      type: Number, // in minutes
      required: true,
      default: 60
    },
    checked: {
      type: Boolean,
      default: false
    },
    checkedAt: {
      type: Date
    },
    locked: {
      type: Boolean,
      default: false
    }
  }],
  breakDuration: {
    type: Number, // in minutes (15, 30, 45, or 60)
    default: null
  },
  breakChecked: {
    type: Boolean,
    default: false
  },
  breakCheckedAt: {
    type: Date
  },
  totalHours: {
    type: Number,
    default: 0
  },
  // Slot IDs assigned by verifier (timetable import). Teacher clicks to mark done; not auto-checked.
  scheduledSlotIds: {
    type: [String],
    default: undefined
  },
  // Per-subject schedule from timetable import (for Planning: subject + hours).
  scheduleEntries: [{
    subjectName: { type: String, default: '' },
    batch: { type: String, default: '' },
    slotIds: { type: [String], default: [] }
  }]
}, {
  timestamps: true
});

// Calculate total hours before saving
dailyTimeSlotSchema.pre('save', function(next) {
  const checkedSlots = this.slots.filter(slot => slot.checked);
  let hours = checkedSlots.reduce((sum, slot) => sum + (slot.duration / 60), 0);
  
  // Add break time if checked (subtract from total hours)
  if (this.breakChecked && this.breakDuration) {
    hours -= (this.breakDuration / 60);
  }
  
  this.totalHours = Math.max(0, hours); // Ensure non-negative
  next();
});

// Compound index for efficient queries
dailyTimeSlotSchema.index({ teacher: 1, date: 1 }, { unique: true });

export default mongoose.model('DailyTimeSlot', dailyTimeSlotSchema);
