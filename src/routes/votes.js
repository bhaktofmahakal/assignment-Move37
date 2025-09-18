const express = require('express');
const prisma = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { broadcastPollUpdate } = require('../websocket/handler');
const { validateVote } = require('../middleware/sanitization');
const { voteLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/', voteLimiter, authenticateToken, validateVote, async (req, res) => {
  try {
    const { pollOptionId } = req.body;

    if (!pollOptionId) {
      return res.status(400).json({ error: 'Poll option ID is required' });
    }

    const pollOption = await prisma.pollOption.findUnique({
      where: { id: pollOptionId },
      include: {
        poll: {
          select: { id: true, isPublished: true }
        }
      }
    });

    if (!pollOption) {
      return res.status(404).json({ error: 'Poll option not found' });
    }

    if (!pollOption.poll.isPublished) {
      return res.status(400).json({ error: 'Cannot vote on unpublished poll' });
    }

    const existingVote = await prisma.vote.findUnique({
      where: {
        userId_pollOptionId: {
          userId: req.user.id,
          pollOptionId
        }
      }
    });

    if (existingVote) {
      return res.status(409).json({ error: 'User already voted for this option' });
    }

    const userVoteInPoll = await prisma.vote.findFirst({
      where: {
        userId: req.user.id,
        pollOption: {
          pollId: pollOption.poll.id
        }
      }
    });

    if (userVoteInPoll) {
      return res.status(409).json({ error: 'User already voted in this poll' });
    }

    const vote = await prisma.vote.create({
      data: {
        userId: req.user.id,
        pollOptionId
      },
      include: {
        user: {
          select: { id: true, name: true }
        },
        pollOption: {
          include: {
            poll: {
              select: { id: true, question: true }
            }
          }
        }
      }
    });

    const updatedPoll = await prisma.poll.findUnique({
      where: { id: pollOption.poll.id },
      include: {
        options: {
          include: {
            _count: {
              select: { votes: true }
            }
          }
        }
      }
    });

    const pollWithVoteCounts = {
      ...updatedPoll,
      options: updatedPoll.options.map(option => ({
        ...option,
        voteCount: option._count.votes
      })),
      totalVotes: updatedPoll.options.reduce((sum, option) => sum + option._count.votes, 0)
    };

    broadcastPollUpdate(pollOption.poll.id, pollWithVoteCounts);

    res.status(201).json(vote);
  } catch (error) {
    console.error('Vote creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const votes = await prisma.vote.findMany({
      where: { userId },
      include: {
        pollOption: {
          include: {
            poll: {
              select: { id: true, question: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(votes);
  } catch (error) {
    console.error('Fetch user votes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/poll/:pollId', async (req, res) => {
  try {
    const { pollId } = req.params;

    const votes = await prisma.vote.findMany({
      where: {
        pollOption: {
          pollId
        }
      },
      include: {
        user: {
          select: { id: true, name: true }
        },
        pollOption: {
          select: { id: true, text: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(votes);
  } catch (error) {
    console.error('Fetch poll votes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;