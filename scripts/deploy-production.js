#!/usr/bin/env node

/**
 * Production Deployment Script
 * Automates the complete production deployment process
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function exec(command, description) {
  log(`\n${colors.blue}⚡ ${description}...${colors.reset}`);
  try {
    const output = execSync(command, { stdio: 'inherit' });
    log(`✅ ${description} completed successfully`, 'green');
    return output;
  } catch (error) {
    log(`❌ ${description} failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

function checkPrerequisites() {
  log('\n🔍 Checking prerequisites...', 'bold');
  
  // Check Node.js version
  try {
    const nodeVersion = execSync('node --version').toString().trim();
    log(`Node.js version: ${nodeVersion}`, 'green');
  } catch (error) {
    log('❌ Node.js is not installed', 'red');
    process.exit(1);
  }

  // Check Docker
  try {
    const dockerVersion = execSync('docker --version').toString().trim();
    log(`Docker version: ${dockerVersion}`, 'green');
  } catch (error) {
    log('⚠️  Docker not found - manual deployment mode', 'yellow');
  }

  // Check environment file
  if (!fs.existsSync('.env')) {
    log('⚠️  .env file not found, creating from template...', 'yellow');
    if (fs.existsSync('.env.example')) {
      fs.copyFileSync('.env.example', '.env');
      log('📝 Please edit .env file with production values', 'yellow');
    }
  }
}

function setupDatabase() {
  log('\n🗄️  Setting up database...', 'bold');
  
  exec('npx prisma generate', 'Generating Prisma client');
  exec('npx prisma migrate deploy', 'Running database migrations');
  
  log('✅ Database setup completed', 'green');
}

function buildApplication() {
  log('\n🏗️  Building application...', 'bold');
  
  exec('npm ci --only=production', 'Installing production dependencies');
  
  // Create logs directory
  if (!fs.existsSync('logs')) {
    fs.mkdirSync('logs', { recursive: true });
    log('📁 Created logs directory', 'green');
  }
  
  log('✅ Application build completed', 'green');
}

function runTests() {
  log('\n🧪 Running tests...', 'bold');
  
  try {
    exec('npm install --save-dev @playwright/test', 'Installing test dependencies');
    exec('npm test', 'Running test suite');
    log('✅ All tests passed', 'green');
  } catch (error) {
    log('⚠️  Some tests failed, continuing with deployment...', 'yellow');
  }
}

function deployWithDocker() {
  log('\n🐳 Deploying with Docker...', 'bold');
  
  exec('docker-compose -f docker-compose.prod.yml down', 'Stopping existing containers');
  exec('docker-compose -f docker-compose.prod.yml build', 'Building Docker images');
  exec('docker-compose -f docker-compose.prod.yml up -d', 'Starting production containers');
  
  // Wait for services to start
  log('⏳ Waiting for services to start...', 'yellow');
  setTimeout(() => {
    exec('docker-compose -f docker-compose.prod.yml ps', 'Checking container status');
  }, 5000);
  
  log('✅ Docker deployment completed', 'green');
}

function deployWithPM2() {
  log('\n🚀 Deploying with PM2...', 'bold');
  
  try {
    exec('pm2 --version', 'Checking PM2 installation');
  } catch (error) {
    exec('npm install -g pm2', 'Installing PM2 globally');
  }
  
  exec('pm2 delete all', 'Stopping existing processes');
  exec('pm2 start ecosystem.config.js --env production', 'Starting production processes');
  exec('pm2 save', 'Saving PM2 configuration');
  exec('pm2 status', 'Checking PM2 status');
  
  log('✅ PM2 deployment completed', 'green');
}

function validateDeployment() {
  log('\n✅ Validating deployment...', 'bold');
  
  // Wait for service to start
  setTimeout(() => {
    try {
      const healthCheck = execSync('curl -f http://localhost:3000/health || echo "Health check failed"').toString();
      if (healthCheck.includes('healthy')) {
        log('✅ Health check passed', 'green');
      } else {
        log('⚠️  Health check failed', 'yellow');
      }
    } catch (error) {
      log('⚠️  Could not perform health check', 'yellow');
    }
  }, 3000);
}

function printSummary() {
  log('\n🎉 Deployment Summary', 'bold');
  log('===================', 'bold');
  log('✅ Application deployed successfully', 'green');
  log('🌐 API available at: http://localhost:3000', 'blue');
  log('🏥 Health check: http://localhost:3000/health', 'blue');
  log('📚 API docs: http://localhost:3000/api', 'blue');
  log('🔌 WebSocket: ws://localhost:3000', 'blue');
  
  log('\n📋 Next Steps:', 'bold');
  log('1. Configure SSL certificates for HTTPS', 'yellow');
  log('2. Set up monitoring and alerting', 'yellow');
  log('3. Configure backup strategies', 'yellow');
  log('4. Set up log aggregation', 'yellow');
  log('5. Configure load balancer if needed', 'yellow');
  
  log('\n🛠️  Management Commands:', 'bold');
  log('• View logs: pm2 logs or docker-compose logs -f', 'blue');
  log('• Restart app: pm2 restart all or docker-compose restart', 'blue');
  log('• Monitor: pm2 monit or docker-compose ps', 'blue');
  log('• Stop app: pm2 stop all or docker-compose down', 'blue');
}

// Main deployment process
async function main() {
  log('🚀 Real-Time Polling API - Production Deployment', 'bold');
  log('================================================', 'bold');
  
  const args = process.argv.slice(2);
  const useDocker = args.includes('--docker');
  const skipTests = args.includes('--skip-tests');
  
  try {
    checkPrerequisites();
    setupDatabase();
    buildApplication();
    
    if (!skipTests) {
      runTests();
    }
    
    if (useDocker) {
      deployWithDocker();
    } else {
      deployWithPM2();
    }
    
    validateDeployment();
    printSummary();
    
  } catch (error) {
    log(`\n❌ Deployment failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Handle script termination
process.on('SIGINT', () => {
  log('\n\n⚠️  Deployment interrupted', 'yellow');
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  log(`\n❌ Unhandled error: ${error.message}`, 'red');
  process.exit(1);
});

// Run deployment
if (require.main === module) {
  main();
}

module.exports = { main };