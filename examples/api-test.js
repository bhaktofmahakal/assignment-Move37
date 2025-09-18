const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

class APITester {
  constructor() {
    this.token = null;
    this.userId = null;
    this.pollId = null;
  }

  async register(userData) {
    try {
      const response = await axios.post(`${BASE_URL}/auth/register`, userData);
      console.log('Registration successful:', response.data);
      this.token = response.data.token;
      this.userId = response.data.user.id;
      return response.data;
    } catch (error) {
      console.error('Registration failed:', error.response?.data || error.message);
      throw error;
    }
  }

  async login(credentials) {
    try {
      const response = await axios.post(`${BASE_URL}/auth/login`, credentials);
      console.log('Login successful:', response.data);
      this.token = response.data.token;
      this.userId = response.data.user.id;
      return response.data;
    } catch (error) {
      console.error('Login failed:', error.response?.data || error.message);
      throw error;
    }
  }

  async createPoll(pollData) {
    try {
      const response = await axios.post(`${BASE_URL}/polls`, pollData, {
        headers: { Authorization: `Bearer ${this.token}` }
      });
      console.log('Poll created:', response.data);
      this.pollId = response.data.id;
      return response.data;
    } catch (error) {
      console.error('Poll creation failed:', error.response?.data || error.message);
      throw error;
    }
  }

  async getPolls() {
    try {
      const response = await axios.get(`${BASE_URL}/polls`);
      console.log(`Retrieved ${response.data.length} polls`);
      return response.data;
    } catch (error) {
      console.error('Failed to get polls:', error.response?.data || error.message);
      throw error;
    }
  }

  async vote(pollOptionId) {
    try {
      const response = await axios.post(`${BASE_URL}/votes`, 
        { pollOptionId },
        { headers: { Authorization: `Bearer ${this.token}` } }
      );
      console.log('Vote cast successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('Vote failed:', error.response?.data || error.message);
      throw error;
    }
  }

  async getPoll(pollId) {
    try {
      const response = await axios.get(`${BASE_URL}/polls/${pollId}`);
      console.log('Poll retrieved:', response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to get poll:', error.response?.data || error.message);
      throw error;
    }
  }

  async runFullTest() {
    console.log('Starting API test suite...\n');

    try {
      // Test 1: Register user
      console.log('Test 1: User Registration');
      await this.register({
        name: 'Test User',
        email: `test-${Date.now()}@example.com`,
        password: 'TestPass123'
      });

      // Test 2: Create poll
      console.log('\nTest 2: Poll Creation');
      const poll = await this.createPoll({
        question: 'What is your favorite programming language?',
        options: ['JavaScript', 'Python', 'Go', 'Rust'],
        isPublished: true
      });

      // Test 3: Get polls
      console.log('\nTest 3: Get All Polls');
      await this.getPolls();

      // Test 4: Get specific poll
      console.log('\nTest 4: Get Specific Poll');
      await this.getPoll(this.pollId);

      // Test 5: Vote
      console.log('\nTest 5: Cast Vote');
      if (poll.options && poll.options.length > 0) {
        await this.vote(poll.options[0].id);
      }

      // Test 6: Get updated poll
      console.log('\nTest 6: Get Updated Poll Results');
      await this.getPoll(this.pollId);

      console.log('\nAll tests completed successfully!');
    } catch (error) {
      console.error('\nTest suite failed:', error.message);
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new APITester();
  
  console.log('Make sure the server is running on http://localhost:3000');
  console.log('Make sure PostgreSQL is running and database is set up');
  console.log('');
  
  setTimeout(() => {
    tester.runFullTest();
  }, 1000);
}

module.exports = APITester;