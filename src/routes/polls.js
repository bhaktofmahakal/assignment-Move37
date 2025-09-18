const express = require('express');
const prisma = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { validatePollCreation } = require('../middleware/sanitization');
const { pollCreationLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/', pollCreationLimiter, authenticateToken, validatePollCreation, async (req, res) => {
  try {
    const { question, options, isPublished = false } = req.body;

    if (!question || !options || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ 
        error: 'Question and at least 2 options are required' 
      });
    }

    const poll = await prisma.poll.create({
      data: {
        question,
        isPublished,
        creatorId: req.user.id,
        options: {
          create: options.map(text => ({ text }))
        }
      },
      include: {
        options: true,
        creator: {
          select: { id: true, name: true }
        }
      }
    });

    res.status(201).json(poll);
  } catch (error) {
    console.error('Create poll error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { published } = req.query;
    
    const polls = await prisma.poll.findMany({
      where: published !== undefined ? { isPublished: published === 'true' } : undefined,
      include: {
        options: {
          include: {
            _count: {
              select: { votes: true }
            }
          }
        },
        creator: {
          select: { id: true, name: true }
        },
        _count: {
          select: { options: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const pollsWithVoteCounts = polls.map(poll => ({
      ...poll,
      options: poll.options.map(option => ({
        ...option,
        voteCount: option._count.votes
      })),
      totalVotes: poll.options.reduce((sum, option) => sum + option._count.votes, 0)
    }));

    res.json(pollsWithVoteCounts);
  } catch (error) {
    console.error('Fetch polls error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const poll = await prisma.poll.findUnique({
      where: { id },
      include: {
        options: {
          include: {
            _count: {
              select: { votes: true }
            }
          }
        },
        creator: {
          select: { id: true, name: true }
        }
      }
    });

    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    const pollWithVoteCounts = {
      ...poll,
      options: poll.options.map(option => ({
        ...option,
        voteCount: option._count.votes
      })),
      totalVotes: poll.options.reduce((sum, option) => sum + option._count.votes, 0)
    };

    res.json(pollWithVoteCounts);
  } catch (error) {
    console.error('Fetch poll error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { question, isPublished } = req.body;

    const existingPoll = await prisma.poll.findUnique({
      where: { id }
    });

    if (!existingPoll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    if (existingPoll.creatorId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to update this poll' });
    }

    const updateData = {};
    if (question !== undefined) updateData.question = question;
    if (isPublished !== undefined) updateData.isPublished = isPublished;

    const updatedPoll = await prisma.poll.update({
      where: { id },
      data: updateData,
      include: {
        options: true,
        creator: {
          select: { id: true, name: true }
        }
      }
    });

    res.json(updatedPoll);
  } catch (error) {
    console.error('Update poll error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const existingPoll = await prisma.poll.findUnique({
      where: { id }
    });

    if (!existingPoll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    if (existingPoll.creatorId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this poll' });
    }

    await prisma.poll.delete({
      where: { id }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Delete poll error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;