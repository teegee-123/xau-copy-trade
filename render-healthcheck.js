/**
 * Render Health Check Script
 * 
 * Lightweight health check for Render.com deployment.
 * Tests the /health endpoint and returns appropriate exit codes.
 * 
 * Usage: node render-healthcheck.js
 */

import http from 'http';

const PORT = process.env.PORT || 3000;
const HOST = 'localhost';
const PATH = '/health';
const TIMEOUT = 5000; // 5 seconds

function checkHealth() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path: PATH,
      method: 'GET',
      timeout: TIMEOUT,
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data);
            if (response.status === 'ok') {
              resolve({ healthy: true, response, statusCode: res.statusCode });
            } else {
              reject(new Error(`Unhealthy status: ${response.status}`));
            }
          } catch (parseError) {
            reject(new Error(`Invalid JSON response: ${parseError.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out after ${TIMEOUT}ms`));
    });

    req.end();
  });
}

async function main() {
  try {
    const result = await checkHealth();
    console.log(`✓ Health check passed: ${JSON.stringify(result.response)}`);
    process.exit(0);
  } catch (error) {
    console.error(`✗ Health check failed: ${error.message}`);
    process.exit(1);
  }
}

main();
