const { _electron: electron } = require('playwright');
const path = require('path');

async function test() {
  console.log('Launching Electron...');
  
  // Point to the root directory where package.json starts Electron, or directly to main.js
  const appDir = 'd:/webs/pharmacy app/apps/desktop';
  
  const electronApp = await electron.launch({
    cwd: appDir,
    executablePath: path.join(appDir, 'node_modules/electron/dist/electron.exe'),
    args: ['.'] // equivalent to running `electron .` in apps/desktop
  });

  console.log('Waiting for window...');
  const window = await electronApp.firstWindow();
  
  // Wait for the React app to mount
  await window.waitForTimeout(5000);
  
  const screenshotDir = path.join(__dirname, '../screenshots');
  console.log('Window loaded, taking initial screenshot...');
  await window.screenshot({ path: path.join(screenshotDir, 'electron_1_init.png') });

  // Check if we need to login
  const pageText = await window.textContent('body');
  if (pageText.toLowerCase().includes('login') || pageText.toLowerCase().includes('password')) {
    console.log('Login screen detected. Attempting to login...');
    const usernameInput = window.locator('input[type="text"]').first();
    const passwordInput = window.locator('input[type="password"]').first();
    
    if (await usernameInput.count() > 0) await usernameInput.fill('admin');
    if (await passwordInput.count() > 0) {
      await passwordInput.fill('admin123');
      await passwordInput.press('Enter');
      await window.waitForTimeout(5000);
    }
  }

  console.log('Attempting to navigate via evaluate...');
  await window.evaluate(() => {
    const link = Array.from(document.querySelectorAll('a')).find(a => a.textContent.includes('History'));
    if (link) link.click();
    else if (window.location.href.includes('localhost')) {
      window.location.href = '/transaction-history';
    }
  });

  await window.waitForTimeout(5000);
  console.log('Taking screenshot of final state...');
  await window.screenshot({ path: path.join(screenshotDir, 'electron_final.png') });
  
  const finalHtml = await window.evaluate(() => document.body.innerHTML);
  require('fs').writeFileSync(path.join(screenshotDir, 'electron_body.html'), finalHtml);

  await electronApp.close();
  console.log('Done');
}

test().catch(console.error);
