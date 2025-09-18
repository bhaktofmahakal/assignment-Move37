#!/usr/bin/env node

/**
 * Production Monitoring Script
 * Monitors the health and performance of the polling API
 */

const http = require('http');
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
  const timestamp = new Date().toISOString();
  console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

class ApplicationMonitor {
  constructor() {
    this.baseUrl = process.env.MONITOR_URL || 'http://localhost:3000';
    this.interval = process.env.MONITOR_INTERVAL || 30000; // 30 seconds
    this.alertThresholds = {
      responseTime: 2000, // 2 seconds
      memoryUsage: 512 * 1024 * 1024, // 512 MB
      errorRate: 0.05 // 5%
    };
    this.metrics = {
      requests: 0,
      errors: 0,
      totalResponseTime: 0,
      lastCheck: Date.now()
    };
  }

  async checkHealth() {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const req = http.get(`${this.baseUrl}/health`, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          const responseTime = Date.now() - startTime;
          this.metrics.requests++;
          this.metrics.totalResponseTime += responseTime;
          
          try {
            const healthData = JSON.parse(data);
            resolve({
              status: res.statusCode,
              responseTime,
              data: healthData,
              healthy: res.statusCode === 200 && healthData.status === 'healthy'
            });
          } catch (error) {
            this.metrics.errors++;
            resolve({
              status: res.statusCode,
              responseTime,
              error: 'Invalid JSON response',
              healthy: false
            });
          }
        });
      });

      req.on('error', (error) => {
        const responseTime = Date.now() - startTime;
        this.metrics.requests++;
        this.metrics.errors++;
        
        resolve({
          status: 0,
          responseTime,
          error: error.message,
          healthy: false
        });
      });

      req.setTimeout(5000, () => {
        req.destroy();
        this.metrics.errors++;
        resolve({
          status: 0,
          responseTime: 5000,
          error: 'Request timeout',
          healthy: false
        });
      });
    });
  }

  async checkDatabase() {
    return new Promise((resolve) => {
      const req = http.get(`${this.baseUrl}/api/polls?limit=1`, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            JSON.parse(data);
            resolve({
              status: res.statusCode,
              healthy: res.statusCode === 200,
              message: 'Database connection OK'
            });
          } catch (error) {
            resolve({
              status: res.statusCode,
              healthy: false,
              message: 'Database response error'
            });
          }
        });
      });

      req.on('error', (error) => {
        resolve({
          status: 0,
          healthy: false,
          message: `Database check failed: ${error.message}`
        });
      });

      req.setTimeout(3000, () => {
        req.destroy();
        resolve({
          status: 0,
          healthy: false,
          message: 'Database check timeout'
        });
      });
    });
  }

  calculateMetrics() {
    const avgResponseTime = this.metrics.requests > 0 
      ? this.metrics.totalResponseTime / this.metrics.requests 
      : 0;
    
    const errorRate = this.metrics.requests > 0 
      ? this.metrics.errors / this.metrics.requests 
      : 0;

    return {
      totalRequests: this.metrics.requests,
      totalErrors: this.metrics.errors,
      averageResponseTime: Math.round(avgResponseTime),
      errorRate: Math.round(errorRate * 100),
      uptime: Date.now() - this.metrics.lastCheck
    };
  }

  checkAlerts(health, database, metrics) {
    const alerts = [];

    if (!health.healthy) {
      alerts.push({
        type: 'CRITICAL',
        message: `Health check failed: ${health.error || 'Unknown error'}`,
        timestamp: new Date().toISOString()
      });
    }

    if (!database.healthy) {
      alerts.push({
        type: 'CRITICAL',
        message: `Database check failed: ${database.message}`,
        timestamp: new Date().toISOString()
      });
    }

    if (health.responseTime > this.alertThresholds.responseTime) {
      alerts.push({
        type: 'WARNING',
        message: `High response time: ${health.responseTime}ms`,
        timestamp: new Date().toISOString()
      });
    }

    if (metrics.errorRate > this.alertThresholds.errorRate * 100) {
      alerts.push({
        type: 'WARNING',
        message: `High error rate: ${metrics.errorRate}%`,
        timestamp: new Date().toISOString()
      });
    }

    return alerts;
  }

  async sendAlert(alert) {
    // Log alert
    log(`🚨 ALERT [${alert.type}]: ${alert.message}`, alert.type === 'CRITICAL' ? 'red' : 'yellow');
    
    // Save to file
    const alertFile = path.join(__dirname, '../logs/alerts.log');
    const alertEntry = `${alert.timestamp} [${alert.type}] ${alert.message}\n`;
    
    try {
      fs.appendFileSync(alertFile, alertEntry);
    } catch (error) {
      log(`Failed to save alert: ${error.message}`, 'red');
    }

    // Here you could integrate with external alerting systems:
    // - Send email notifications
    // - Post to Slack/Discord
    // - Send to monitoring services (DataDog, New Relic, etc.)
    // - Trigger PagerDuty incidents
  }

  async monitor() {
    log('🔍 Starting monitoring check...', 'blue');

    try {
      // Run health checks
      const [health, database] = await Promise.all([
        this.checkHealth(),
        this.checkDatabase()
      ]);

      // Calculate metrics
      const metrics = this.calculateMetrics();

      // Check for alerts
      const alerts = this.checkAlerts(health, database, metrics);

      // Send alerts if any
      for (const alert of alerts) {
        await this.sendAlert(alert);
      }

      // Log status
      if (health.healthy && database.healthy) {
        log(`✅ System healthy - Response: ${health.responseTime}ms, Errors: ${metrics.errorRate}%`, 'green');
      } else {
        log(`❌ System issues detected`, 'red');
      }

      // Detailed status
      log(`📊 Metrics: ${metrics.totalRequests} requests, ${metrics.averageResponseTime}ms avg response`, 'blue');

      // Save metrics
      const metricsFile = path.join(__dirname, '../logs/metrics.json');
      const metricsData = {
        timestamp: new Date().toISOString(),
        health,
        database,
        metrics,
        alerts: alerts.length
      };

      try {
        fs.writeFileSync(metricsFile, JSON.stringify(metricsData, null, 2));
      } catch (error) {
        log(`Failed to save metrics: ${error.message}`, 'yellow');
      }

    } catch (error) {
      log(`❌ Monitoring error: ${error.message}`, 'red');
      await this.sendAlert({
        type: 'CRITICAL',
        message: `Monitoring script error: ${error.message}`,
        timestamp: new Date().toISOString()
      });
    }
  }

  start() {
    log('🚀 Starting Real-Time Polling API Monitor', 'bold');
    log(`📡 Monitoring URL: ${this.baseUrl}`, 'blue');
    log(`⏰ Check interval: ${this.interval}ms`, 'blue');
    log('=====================================', 'bold');

    // Initial check
    this.monitor();

    // Schedule regular checks
    setInterval(() => {
      this.monitor();
    }, this.interval);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      log('🛑 Monitoring stopped', 'yellow');
      process.exit(0);
    });
  }

  async generateReport() {
    log('📋 Generating monitoring report...', 'blue');

    try {
      const metricsFile = path.join(__dirname, '../logs/metrics.json');
      const alertsFile = path.join(__dirname, '../logs/alerts.log');

      let metrics = {};
      if (fs.existsSync(metricsFile)) {
        const data = fs.readFileSync(metricsFile, 'utf8');
        metrics = JSON.parse(data);
      }

      let alerts = '';
      if (fs.existsSync(alertsFile)) {
        alerts = fs.readFileSync(alertsFile, 'utf8');
      }

      const report = `
Real-Time Polling API - Monitoring Report
=========================================
Generated: ${new Date().toISOString()}

System Status:
- Health: ${metrics.health?.healthy ? '✅ Healthy' : '❌ Unhealthy'}
- Database: ${metrics.database?.healthy ? '✅ Connected' : '❌ Disconnected'}
- Response Time: ${metrics.health?.responseTime || 'N/A'}ms

Metrics:
- Total Requests: ${metrics.metrics?.totalRequests || 0}
- Error Rate: ${metrics.metrics?.errorRate || 0}%
- Average Response Time: ${metrics.metrics?.averageResponseTime || 0}ms

Recent Alerts:
${alerts || 'No recent alerts'}

Recommendations:
- Monitor response times during peak usage
- Set up log aggregation for better insights
- Configure automated scaling if needed
- Regular database maintenance and optimization
      `;

      const reportFile = path.join(__dirname, '../logs/monitoring-report.txt');
      fs.writeFileSync(reportFile, report);

      log('📄 Report saved to logs/monitoring-report.txt', 'green');
      console.log(report);

    } catch (error) {
      log(`❌ Report generation failed: ${error.message}`, 'red');
    }
  }
}

// CLI handling
const monitor = new ApplicationMonitor();

const command = process.argv[2];
switch (command) {
  case 'start':
    monitor.start();
    break;
  case 'check':
    monitor.monitor();
    break;
  case 'report':
    monitor.generateReport();
    break;
  default:
    console.log(`
Usage: node monitor.js [command]

Commands:
  start   - Start continuous monitoring
  check   - Run single health check
  report  - Generate monitoring report

Environment Variables:
  MONITOR_URL      - URL to monitor (default: http://localhost:3000)
  MONITOR_INTERVAL - Check interval in ms (default: 30000)
    `);
}

module.exports = ApplicationMonitor;