const { test, expect } = require('@playwright/test');

test.describe('WebSocket Simple Connection Tests', () => {
  test('should connect to WebSocket and receive welcome message', async ({ page }) => {
    // Test WebSocket connection directly in the browser context
    const result = await page.evaluate(async () => {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket('ws://localhost:3000');
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Connection timeout'));
        }, 5000);

        ws.onopen = () => {
          console.log('WebSocket opened');
        };

        ws.onmessage = (event) => {
          clearTimeout(timeout);
          try {
            const data = JSON.parse(event.data);
            ws.close();
            resolve(data);
          } catch (error) {
            ws.close();
            reject(error);
          }
        };

        ws.onerror = (error) => {
          clearTimeout(timeout);
          ws.close();
          reject(new Error('WebSocket error'));
        };

        ws.onclose = (event) => {
          if (!event.wasClean) {
            clearTimeout(timeout);
            reject(new Error('WebSocket closed unexpectedly'));
          }
        };
      });
    });

    expect(result.type).toBe('connected');
    expect(result.message).toContain('Connected to real-time polling service');
    expect(result.clientId).toBeDefined();
  });

  test('should handle ping-pong messages', async ({ page }) => {
    const result = await page.evaluate(async () => {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket('ws://localhost:3000');
        let welcomeReceived = false;
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Ping-pong timeout'));
        }, 10000);

        ws.onopen = () => {
          console.log('WebSocket opened for ping test');
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'connected' && !welcomeReceived) {
              welcomeReceived = true;
              // Send ping after welcome message
              ws.send(JSON.stringify({ type: 'ping' }));
            } else if (data.type === 'pong') {
              clearTimeout(timeout);
              ws.close();
              resolve(data);
            }
          } catch (error) {
            clearTimeout(timeout);
            ws.close();
            reject(error);
          }
        };

        ws.onerror = (error) => {
          clearTimeout(timeout);
          ws.close();
          reject(new Error('WebSocket error during ping test'));
        };
      });
    });

    expect(result.type).toBe('pong');
    expect(result.timestamp).toBeDefined();
  });
});