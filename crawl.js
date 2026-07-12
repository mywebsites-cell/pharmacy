const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const BASE_URL = 'http://localhost:5173';

const ROUTES = [
  { name: '01_dashboard',          path: '/' },
  { name: '02_sales_pos',          path: '/sales' },
  { name: '03_transaction_history', path: '/transaction-history' },
  { name: '04_sales_history',      path: '/sales-history' },
  { name: '05_dues',               path: '/dues' },
  { name: '06_inventory',          path: '/inventory' },
  { name: '07_customers',          path: '/customers' },
  { name: '08_refunds',            path: '/refunds' },
  { name: '09_accounting',         path: '/accounting' },
  { name: '10_analytics',          path: '/analytics' },
];

async function crawl() {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const results = [];

  // First load — might hit login/activation screen
  console.log('Loading app root...');
  const t0 = Date.now();
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  const rootTitle = await page.title();
  const rootScreenshot = path.join(SCREENSHOTS_DIR, '00_initial_load.png');
  await page.screenshot({ path: rootScreenshot, fullPage: true });
  console.log(`Initial load: ${Date.now() - t0}ms — "${rootTitle}"`);
  results.push({ route: '/', name: 'Initial Load', loadMs: Date.now() - t0, title: rootTitle, screenshot: rootScreenshot });

  // Check if we're on login screen
  const pageText = await page.textContent('body');
  const isLoginScreen = pageText.includes('Login') || pageText.includes('Activate') || pageText.includes('Password') || pageText.includes('license');
  console.log('Is login screen:', isLoginScreen);

  // Try to find and interact with login if present
  if (isLoginScreen) {
    console.log('Login/activation screen detected. Attempting login...');
    // Try common username/password combinations
    const usernameInput = page.locator('input[type="text"], input[name="username"], input[placeholder*="user" i], input[placeholder*="name" i]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    
    if (await usernameInput.count() > 0) {
      await usernameInput.fill('admin');
    }
    if (await passwordInput.count() > 0) {
      await passwordInput.fill('admin123');
      await passwordInput.press('Enter');
      await page.waitForTimeout(3000);
      const afterLoginScreenshot = path.join(SCREENSHOTS_DIR, '00b_after_login.png');
      await page.screenshot({ path: afterLoginScreenshot, fullPage: true });
      console.log('After login attempt screenshot saved');
    }
  }

  // Navigate to each route
  for (const route of ROUTES) {
    console.log(`\nVisiting ${route.path}...`);
    const start = Date.now();
    
    try {
      await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      // Wait for React to render and data to load
      await page.waitForTimeout(3000);
      
      const loadMs = Date.now() - start;
      const title = await page.title();
      const text = await page.textContent('body');
      
      // Check for errors
      const hasError = text.includes('Error') || text.includes('error') || text.includes('failed') || text.includes('Cannot');
      const hasSpinner = await page.locator('.animate-spin, [class*="spin"], [class*="loading"]').count() > 0;
      const hasData = text.length > 500; // Has substantial content
      
      const screenshotPath = path.join(SCREENSHOTS_DIR, `${route.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      
      const result = {
        route: route.path,
        name: route.name,
        loadMs,
        title,
        hasError,
        hasSpinner,
        hasData,
        screenshot: screenshotPath,
        textLength: text.length,
      };
      results.push(result);
      
      const status = hasError ? '❌ ERROR' : hasSpinner ? '⏳ LOADING' : hasData ? '✅ OK' : '⚠️ EMPTY';
      console.log(`  ${status} — ${loadMs}ms — ${text.length} chars`);
      
    } catch (err) {
      console.log(`  ❌ FAILED: ${err.message}`);
      results.push({ route: route.path, name: route.name, loadMs: -1, error: err.message });
    }
  }

  // Save results JSON
  const resultsPath = path.join(SCREENSHOTS_DIR, 'crawl_results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\n✅ Crawl complete. Results: ${resultsPath}`);
  
  // Print summary
  console.log('\n=== SUMMARY ===');
  for (const r of results) {
    const status = r.error ? '❌ FAILED' : r.hasError ? '⚠️  ERROR' : r.hasSpinner ? '⏳ LOADING' : '✅ OK';
    console.log(`${status} ${r.route} — ${r.loadMs}ms`);
  }

  await browser.close();
}

crawl().catch(console.error);
