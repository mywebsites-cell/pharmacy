const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOTS_DIR = 'C:\\Users\\ahmad\\.gemini\\antigravity\\brain\\f0a93763-25cc-4c01-8fd2-d699f836bf82\\screenshots';
const BASE_URL = 'http://localhost:3000';

async function crawl() {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Loading app root...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  const pageText = await page.textContent('body');
  if (pageText.includes('Login') || pageText.includes('Activate') || pageText.includes('Password') || pageText.includes('license')) {
    console.log('Login screen detected. Attempting login...');
    const usernameInput = page.locator('input[type="text"], input[name="username"], input[placeholder*="user" i], input[placeholder*="name" i]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    
    if (await usernameInput.count() > 0) {
      await usernameInput.fill('admin');
    }
    if (await passwordInput.count() > 0) {
      await passwordInput.fill('admin123');
      await passwordInput.press('Enter');
      await page.waitForTimeout(3000);
    }
  }

  console.log('Visiting Transaction History...');
  await page.goto(`${BASE_URL}/transaction-history`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  
  await page.waitForTimeout(3000);
  
  const screenshotPath = path.join(SCREENSHOTS_DIR, `11_transaction_history_fixed.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`Screenshot saved to ${screenshotPath}`);

  console.log('Leaving browser open for 60 seconds so you can see it...');
  await page.waitForTimeout(60000);

  await browser.close();
}

crawl().catch(console.error);
