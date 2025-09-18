const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:3000/api';

// Use serial execution to avoid race conditions
test.describe.configure({ mode: 'serial' });

let testUser;
let authToken = '';
let userId = '';
let pollId = '';
let pollOptionId = '';

test.describe('Real-Time Polling API Tests', () => {
  
  test.beforeAll(async () => {
    // Create unique test user data for this test run
    testUser = {
      name: 'Test User',
      email: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com`,
      password: 'TestPass123' // Updated to meet validation requirements
    };
  });
  
  test('should register a new user', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/auth/register`, {
      data: testUser
    });
    
    expect(response.status()).toBe(201);
    
    const data = await response.json();
    expect(data.user).toBeDefined();
    expect(data.user.name).toBe(testUser.name);
    expect(data.user.email).toBe(testUser.email);
    expect(data.token).toBeDefined();
    expect(data.user.passwordHash).toBeUndefined();
    
    authToken = data.token;
    userId = data.user.id;
  });

  test('should not register user with duplicate email', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/auth/register`, {
      data: testUser
    });
    
    expect(response.status()).toBe(409);
    
    const data = await response.json();
    expect(data.error).toContain('already exists');
  });

  test('should login with valid credentials', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/auth/login`, {
      data: {
        email: testUser.email,
        password: testUser.password
      }
    });
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.user).toBeDefined();
    expect(data.token).toBeDefined();
    expect(data.user.email).toBe(testUser.email);
  });

  test('should not login with invalid credentials', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/auth/login`, {
      data: {
        email: testUser.email,
        password: 'wrongpassword'
      }
    });
    
    expect(response.status()).toBe(401);
    
    const data = await response.json();
    expect(data.error).toContain('Invalid credentials');
  });

  test('should create a poll with authentication', async ({ request }) => {
    const pollData = {
      question: 'What is your favorite testing framework?',
      options: ['Playwright', 'Cypress', 'Selenium', 'Jest'],
      isPublished: true
    };

    const response = await request.post(`${BASE_URL}/polls`, {
      data: pollData,
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    expect(response.status()).toBe(201);
    
    const data = await response.json();
    expect(data.question).toBe(pollData.question);
    expect(data.isPublished).toBe(true);
    expect(data.options).toHaveLength(4);
    expect(data.creator.id).toBe(userId);
    
    pollId = data.id;
    pollOptionId = data.options[0].id;
  });

  test('should not create poll without authentication', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/polls`, {
      data: {
        question: 'Test Poll',
        options: ['Option 1', 'Option 2']
      }
    });
    
    expect(response.status()).toBe(401);
  });

  test('should retrieve all polls', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/polls`);
    
    expect(response.status()).toBe(200);
    
    const polls = await response.json();
    expect(Array.isArray(polls)).toBe(true);
    expect(polls.length).toBeGreaterThan(0);
    
    const createdPoll = polls.find(p => p.id === pollId);
    expect(createdPoll).toBeDefined();
    expect(createdPoll.totalVotes).toBeDefined();
  });

  test('should retrieve a specific poll', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/polls/${pollId}`);
    
    expect(response.status()).toBe(200);
    
    const poll = await response.json();
    expect(poll.id).toBe(pollId);
    expect(poll.options).toHaveLength(4);
    expect(poll.totalVotes).toBe(0);
    
    poll.options.forEach(option => {
      expect(option.voteCount).toBe(0);
    });
  });

  test('should cast a vote', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/votes`, {
      data: {
        pollOptionId: pollOptionId
      },
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    expect(response.status()).toBe(201);
    
    const vote = await response.json();
    expect(vote.userId).toBe(userId);
    expect(vote.pollOptionId).toBe(pollOptionId);
  });

  test('should not allow duplicate vote from same user', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/votes`, {
      data: {
        pollOptionId: pollOptionId
      },
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    expect(response.status()).toBe(409);
    
    const data = await response.json();
    expect(data.error).toContain('already voted');
  });

  test('should show updated vote counts after voting', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/polls/${pollId}`);
    
    expect(response.status()).toBe(200);
    
    const poll = await response.json();
    expect(poll.totalVotes).toBe(1);
    
    const votedOption = poll.options.find(opt => opt.id === pollOptionId);
    expect(votedOption.voteCount).toBe(1);
  });

  test('should retrieve user votes', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/votes/user/${userId}`);
    
    expect(response.status()).toBe(200);
    
    const votes = await response.json();
    expect(Array.isArray(votes)).toBe(true);
    expect(votes.length).toBe(1);
    expect(votes[0].userId).toBe(userId);
  });

  test('should retrieve poll votes', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/votes/poll/${pollId}`);
    
    expect(response.status()).toBe(200);
    
    const votes = await response.json();
    expect(Array.isArray(votes)).toBe(true);
    expect(votes.length).toBe(1);
    expect(votes[0].pollOption.id).toBe(pollOptionId);
  });

  test('should update poll as creator', async ({ request }) => {
    const updateData = {
      question: 'Updated: What is your favorite testing framework?',
      isPublished: false
    };

    const response = await request.put(`${BASE_URL}/polls/${pollId}`, {
      data: updateData,
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    expect(response.status()).toBe(200);
    
    const poll = await response.json();
    expect(poll.question).toBe(updateData.question);
    expect(poll.isPublished).toBe(false);
  });

  test('should get health check', async ({ request }) => {
    const response = await request.get('http://localhost:3000/health');
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.status).toBe('healthy');
    expect(data.timestamp).toBeDefined();
  });

  test('should handle invalid poll ID gracefully', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/polls/invalid-id`);
    
    expect(response.status()).toBe(404);
    
    const data = await response.json();
    expect(data.error).toContain('not found');
  });

  test('should validate required fields for poll creation', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/polls`, {
      data: {
        question: 'Test Poll'
        // Missing options
      },
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    expect(response.status()).toBe(400);
    
    const data = await response.json();
    expect(data.error).toContain('options');
  });
});