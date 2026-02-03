const mongoose = require('mongoose');

/**
 * JobCounter Schema - Tracks sequential job numbers per job code
 *
 * Example:
 * - { jobCode: "ABT", lastNumber: 5 } -> Next job will be ABT-006
 * - { jobCode: "JOB", lastNumber: 100 } -> Next job will be JOB-101
 */
const jobCounterSchema = new mongoose.Schema({
  jobCode: { type: String, required: true, unique: true, uppercase: true },
  lastNumber: { type: Number, default: 0 }
}, {
  collection: 'jobcounters'
});

const JobCounter = mongoose.model('JobCounter', jobCounterSchema);

/**
 * Get next sequential job ID for a given job code
 * Uses findOneAndUpdate with upsert for atomic increment (handles concurrency)
 *
 * @param {string} jobCode - The job code prefix (e.g., "ABT", "JOB")
 * @param {number} padding - Number of digits to pad (default: 3 for 001, 002, etc.)
 * @returns {string} - The next job ID (e.g., "ABT-001", "ABT-002")
 */
const getNextJobId = async (jobCode = 'JOB', padding = 3) => {
  const code = jobCode.toUpperCase().trim();

  // Atomically increment and return the new counter value
  const counter = await JobCounter.findOneAndUpdate(
    { jobCode: code },
    { $inc: { lastNumber: 1 } },
    {
      new: true,      // Return the updated document
      upsert: true,   // Create if doesn't exist
      setDefaultsOnInsert: true
    }
  );

  // Format: ABT001, ABT002, etc.
  const paddedNumber = String(counter.lastNumber).padStart(padding, '0');
  return `${code}${paddedNumber}`;
};

/**
 * Get current counter value for a job code (without incrementing)
 *
 * @param {string} jobCode - The job code prefix
 * @returns {number} - Current counter value (0 if not exists)
 */
const getCurrentCounter = async (jobCode) => {
  const code = jobCode.toUpperCase().trim();
  const counter = await JobCounter.findOne({ jobCode: code });
  return counter ? counter.lastNumber : 0;
};

/**
 * Set counter to a specific value (useful for initialization or migration)
 *
 * @param {string} jobCode - The job code prefix
 * @param {number} value - The value to set
 */
const setCounter = async (jobCode, value) => {
  const code = jobCode.toUpperCase().trim();
  await JobCounter.findOneAndUpdate(
    { jobCode: code },
    { $set: { lastNumber: value } },
    { upsert: true }
  );
};

module.exports = {
  JobCounter,
  getNextJobId,
  getCurrentCounter,
  setCounter
};
