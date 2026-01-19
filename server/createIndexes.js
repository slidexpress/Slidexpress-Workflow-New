// createIndexes.js - Run this once to create all database indexes for fast queries
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const Ticket = require('./models/Ticket');
const Email = require('./models/Email');
const TeamMember = require('./models/TeamMember');

async function createIndexes() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('📊 Creating indexes for Ticket model...');
    await Ticket.createIndexes();
    console.log('✅ Ticket indexes created\n');

    console.log('📊 Creating indexes for Email model...');
    await Email.createIndexes();
    console.log('✅ Email indexes created\n');

    console.log('📊 Creating indexes for TeamMember model...');
    await TeamMember.createIndexes();
    console.log('✅ TeamMember indexes created\n');

    // Show all indexes
    console.log('📋 Current Ticket indexes:');
    const ticketIndexes = await Ticket.collection.getIndexes();
    console.log(JSON.stringify(ticketIndexes, null, 2));

    console.log('\n📋 Current Email indexes:');
    const emailIndexes = await Email.collection.getIndexes();
    console.log(JSON.stringify(emailIndexes, null, 2));

    console.log('\n📋 Current TeamMember indexes:');
    const teamMemberIndexes = await TeamMember.collection.getIndexes();
    console.log(JSON.stringify(teamMemberIndexes, null, 2));

    console.log('\n✅ All indexes created successfully!');
    console.log('⚡ Database queries will now be MUCH faster!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    process.exit(1);
  }
}

createIndexes();
