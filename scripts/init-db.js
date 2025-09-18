const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function initializeDatabase() {
  try {
    console.log('Initializing database with sample data...');

    // Create sample users
    console.log('Creating sample users...');
    
    const user1 = await prisma.user.create({
      data: {
        name: 'John Doe',
        email: 'john@example.com',
        passwordHash: await bcrypt.hash('Password123', 12)
      }
    });

    const user2 = await prisma.user.create({
      data: {
        name: 'Jane Smith',
        email: 'jane@example.com',
        passwordHash: await bcrypt.hash('Password123', 12)
      }
    });

    console.log(`Created users: ${user1.name}, ${user2.name}`);

    // Create sample polls
    console.log('Creating sample polls...');
    
    const poll1 = await prisma.poll.create({
      data: {
        question: 'What is your favorite programming language?',
        isPublished: true,
        creatorId: user1.id,
        options: {
          create: [
            { text: 'JavaScript' },
            { text: 'Python' },
            { text: 'Go' },
            { text: 'Rust' }
          ]
        }
      },
      include: {
        options: true
      }
    });

    const poll2 = await prisma.poll.create({
      data: {
        question: 'Which framework do you prefer for web development?',
        isPublished: true,
        creatorId: user2.id,
        options: {
          create: [
            { text: 'React' },
            { text: 'Vue.js' },
            { text: 'Angular' },
            { text: 'Svelte' }
          ]
        }
      },
      include: {
        options: true
      }
    });

    const poll3 = await prisma.poll.create({
      data: {
        question: 'What is the best database for web applications?',
        isPublished: false,
        creatorId: user1.id,
        options: {
          create: [
            { text: 'PostgreSQL' },
            { text: 'MySQL' },
            { text: 'MongoDB' },
            { text: 'SQLite' }
          ]
        }
      },
      include: {
        options: true
      }
    });

    console.log(`Created ${3} polls with options`);

    // Create sample votes
    console.log('Creating sample votes...');
    
    // User 1 votes on poll 2
    await prisma.vote.create({
      data: {
        userId: user1.id,
        pollOptionId: poll2.options[0].id // React
      }
    });

    // User 2 votes on poll 1
    await prisma.vote.create({
      data: {
        userId: user2.id,
        pollOptionId: poll1.options[1].id // Python
      }
    });

    console.log('Created sample votes');

    // Display summary
    const totalUsers = await prisma.user.count();
    const totalPolls = await prisma.poll.count();
    const totalVotes = await prisma.vote.count();
    const publishedPolls = await prisma.poll.count({ where: { isPublished: true } });

    console.log('\nDatabase Summary:');
    console.log(`   Users: ${totalUsers}`);
    console.log(`   Polls: ${totalPolls} (${publishedPolls} published)`);
    console.log(`   Votes: ${totalVotes}`);

    console.log('\nDatabase initialization completed successfully!');
    console.log('\nSample credentials:');
    console.log('   Email: john@example.com | Password: password123');
    console.log('   Email: jane@example.com | Password: password123');

  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run initialization if this file is executed directly
if (require.main === module) {
  initializeDatabase();
}

module.exports = { initializeDatabase };