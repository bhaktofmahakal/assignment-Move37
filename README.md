# Real-Time Polling Application API

A robust backend service for real-time polling with WebSocket support, built with Node.js, Express, PostgreSQL, and Prisma.

## Quick Start

```bash
# Clone and setup
git clone <repository-url>
cd real-time-polling-api
npm install

# Setup environment
cp .env.example .env
# Edit .env with your PostgreSQL credentials

# Setup database
npm run db:generate
npm run db:migrate
npm run db:init    # Optional: Add sample data

# Start the server
npm run dev
```

The API will be running at `http://localhost:3000`

## Features

- **RESTful API** for managing users, polls, and votes
- **Real-time updates** via WebSocket connections
- **Secure authentication** with JWT tokens
- **PostgreSQL database** with proper relational design
- **Prisma ORM** for type-safe database operations
- **Comprehensive validation** and error handling

## Tech Stack

- **Backend**: Node.js with Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Real-time**: WebSocket (ws library)
- **Authentication**: JWT with bcryptjs
- **Security**: Helmet, CORS
- **Testing**: Playwright (E2E), Node.js (Integration)

## Project Structure

```
src/
├── config/
│   └── database.js          # Prisma client configuration
├── middleware/
│   └── auth.js              # JWT authentication middleware
├── routes/
│   ├── auth.js              # Authentication endpoints
│   ├── users.js             # User management endpoints
│   ├── polls.js             # Poll management endpoints
│   └── votes.js             # Voting endpoints
├── websocket/
│   └── handler.js           # WebSocket connection handler
└── server.js                # Main application entry point

examples/
├── api-test.js              # Comprehensive API testing examples
└── websocket-client.html    # WebSocket client demo

scripts/
└── init-db.js               # Database initialization with sample data

tests/
├── api.spec.js              # API endpoint tests (Playwright)
└── websocket.spec.js        # WebSocket functionality tests

prisma/
├── schema.prisma            # Database schema definition
└── migrations/              # Database migration files
```

## Database Schema

### Entities and Relationships

- **User**: `id`, `name`, `email`, `passwordHash`
- **Poll**: `id`, `question`, `isPublished`, `createdAt`, `updatedAt`
- **PollOption**: `id`, `text`
- **Vote**: `id`, `createdAt`

### Relationships

- **One-to-Many**: User → Polls, Poll → PollOptions
- **Many-to-Many**: Users ↔ PollOptions (through Vote table)

## Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v13 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd real-time-polling-api
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp .env.example .env
   ```
   
   Update the `.env` file with your database credentials:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/polling_db"
   JWT_SECRET="your-super-secret-jwt-key"
   PORT=3000
   ```
   
   > **Note**: WebSocket runs on the same port as the HTTP server (PORT=3000)

4. **Database setup**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Run database migrations
   npm run db:migrate
   
   # Initialize database with sample data (optional)
   npm run db:init
   ```

5. **Start the application**
   ```bash
   # Development mode with auto-reload
   npm run dev
   
   # Production mode
   npm start
   ```

The API will be available at `http://localhost:3000` and WebSocket at `ws://localhost:3000`.

### Sample Data

After running `npm run db:init`, you can use these credentials:
- **User 1**: `john@example.com` / `Password123`
- **User 2**: `jane@example.com` / `Password123`

The initialization creates sample polls and voting data for testing.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user

### Users
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `GET /api/users/me` - Get current user (requires auth)

### Polls
- `GET /api/polls` - Get all polls (with optional `?published=true` filter)
- `GET /api/polls/:id` - Get poll by ID
- `POST /api/polls` - Create new poll (requires auth)
- `PUT /api/polls/:id` - Update poll (requires auth, creator only)
- `DELETE /api/polls/:id` - Delete poll (requires auth, creator only)

### Votes
- `POST /api/votes` - Cast a vote (requires auth)
- `GET /api/votes/user/:userId` - Get votes by user
- `GET /api/votes/poll/:pollId` - Get votes for a poll

### Health Check
- `GET /health` - Application health status

## WebSocket API

### Connection
Connect to `ws://localhost:3000`

### Message Types

#### Subscribe to Poll Updates
```json
{
  "type": "subscribe",
  "pollId": "poll-id-here"
}
```

#### Unsubscribe from Poll Updates
```json
{
  "type": "unsubscribe", 
  "pollId": "poll-id-here"
}
```

#### Ping/Pong
```json
{
  "type": "ping"
}
```

### Received Messages

#### Poll Update (when someone votes)
```json
{
  "type": "pollUpdate",
  "pollId": "poll-id",
  "poll": {
    "id": "poll-id",
    "question": "Poll question",
    "options": [...],
    "totalVotes": 10
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## API Usage Examples

### Register a User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "securepassword"
  }'
```

### Create a Poll
```bash
curl -X POST http://localhost:3000/api/polls \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "question": "What is your favorite programming language?",
    "options": ["JavaScript", "Python", "Go", "Rust"],
    "isPublished": true
  }'
```

### Cast a Vote
```bash
curl -X POST http://localhost:3000/api/votes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "pollOptionId": "poll-option-id-here"
  }'
```

## Development

### Available Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with auto-reload
- `npm run db:migrate` - Run database migrations
- `npm run db:generate` - Generate Prisma client
- `npm run db:studio` - Open Prisma Studio
- `npm run db:init` - Initialize database with sample data
- `npm test` - Run E2E tests with Playwright
- `npm run test:api` - Run API integration tests

### Database Management
```bash
# View database in browser
npm run db:studio

# Reset database (⚠️ destructive)
npx prisma migrate reset

# Deploy migrations to production
npx prisma migrate deploy
```

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: Passwords hashed with bcryptjs (12 rounds)
- **CORS Protection**: Configurable cross-origin requests
- **Helmet**: Security headers middleware
- **Input Validation**: Request payload validation
- **SQL Injection Protection**: Prisma ORM prevents SQL injection

## Error Handling

The API returns consistent error responses:

```json
{
  "error": "Error message describing what went wrong"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `500` - Internal Server Error

## Testing

The project includes comprehensive testing with **Playwright** for end-to-end testing.

### Run Tests
```bash
# Run all E2E tests
npm test

# Run API integration tests
npm run test:api
```

### Test Coverage
- **API Tests**: User registration, authentication, poll CRUD, voting
- **WebSocket Tests**: Real-time connections, subscriptions, message handling
- **Integration Tests**: End-to-end workflows and error scenarios

### Test Examples
The `examples/` directory contains:
- `api-test.js` - Complete API workflow demonstration
- `websocket-client.html` - Interactive WebSocket client for manual testing

To use the WebSocket client demo, open `examples/websocket-client.html` in your browser after starting the server.

## 🚀 Production Deployment

### Quick Start Commands
```bash
# Docker deployment (recommended)
npm run docker:prod

# Manual deployment with PM2
npm run deploy

# Start monitoring system
npm run monitor
```

### Docker Deployment (Recommended)

1. **Clone and configure**
   ```bash
   git clone <repository-url>
   cd real-time-polling-api
   ```

2. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your production values
   ```

3. **Deploy with Docker Compose**
   ```bash
   npm run docker:prod
   # OR: docker-compose -f docker-compose.prod.yml up -d
   ```

   This will start:
   - PostgreSQL database
   - Redis cache
   - Application server
   - Nginx reverse proxy

4. **Check deployment health**
   ```bash
   curl http://localhost/health
   ```

### Production Scripts Available
```bash
# Development
npm run dev                # Start development server
npm run test              # Run test suite
npm run test:api          # Run API tests

# Production Deployment
npm run deploy            # Full production deployment
npm run deploy:docker     # Docker deployment
npm run pm2:start         # Start with PM2
npm run pm2:restart       # Restart PM2 processes
npm run pm2:logs          # View PM2 logs

# Monitoring & Health
npm run monitor           # Start monitoring system
npm run monitor:check     # Single health check
npm run monitor:report    # Generate monitoring report

# Docker Management
npm run docker:prod       # Start production containers
npm run docker:prod:down  # Stop production containers
npm run docker:prod:logs  # View production logs
```

### Manual Deployment

1. **Server setup**
   ```bash
   # Install Node.js 18+, PostgreSQL 13+, Redis
   npm install --production
   ```

2. **Environment configuration**
   ```bash
   cp .env.production .env
   # Configure database, JWT secret, etc.
   ```

3. **Database setup**
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

4. **Start with PM2 (recommended)**
   ```bash
   npm install -g pm2
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

### SSL Configuration

1. **Obtain SSL certificates** (Let's Encrypt recommended)
2. **Update nginx configuration** with SSL settings
3. **Enable HTTPS** in docker-compose.yml

### Monitoring & Maintenance

- **Health checks**: `GET /health`
- **Logs**: `docker-compose logs -f app`
- **Metrics**: Available via application logs
- **Database backups**: Set up automated PostgreSQL backups
- **Log rotation**: Configured via Winston

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License.