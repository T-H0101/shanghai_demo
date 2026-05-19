const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to login
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    console.log('=== Test 1: Empty form submission ===');

    // Click submit button
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);

    // Check for error message
    const errorEl = await page.locator('.text-red-400').first();
    const errorText = await errorEl.textContent();
    console.log('Error message:', errorText);

    // Test 2: Fill account only
    console.log('\n=== Test 2: Account only, no password ===');
    await page.fill('#account', 'admin');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);

    const errorEl2 = await page.locator('.text-red-400').first();
    const errorText2 = await errorEl2.textContent();
    console.log('Password error:', errorText2);

    // Test 3: Wrong password
    console.log('\n=== Test 3: Wrong password ===');
    await page.fill('#password', 'wrongpassword');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    const errorEl3 = await page.locator('.text-red-400').first();
    const errorText3 = await errorEl3 ? await errorEl3.textContent() : 'No error shown';
    console.log('Wrong password error:', errorText3);

    // Test 4: Successful login
    console.log('\n=== Test 4: Successful login (admin/admin) ===');
    await page.fill('#account', 'admin');
    await page.fill('#password', 'admin');
    await page.waitForTimeout(500);

    // Select site if needed
    const siteSelect = await page.locator('[data-radix-collection-item]').first();
    if (await siteSelect.count() > 0) {
      await siteSelect.click();
      await page.waitForTimeout(300);
    }

    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    console.log('Current URL after login:', currentUrl);
    const success = currentUrl === 'http://localhost:3000/' || currentUrl.endsWith('/');
    console.log('Login success:', success);

    // Navigate to users page if logged in
    if (success) {
      console.log('\n=== Test 5: User management page ===');
      await page.goto('http://localhost:3000/users', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const usersTable = await page.locator('table').count();
      console.log('Users table found:', usersTable > 0);

      // Check for "访客-上海" user
      const guestUser = await page.locator('text=访客-上海').count();
      console.log('Guest user (访客-上海) found:', guestUser > 0);

      // Test unlock button
      console.log('\n=== Test 6: Unlock user ===');
      const unlockBtn = await page.locator('button:has-text("解锁")').first();
      if (await unlockBtn.count() > 0) {
        await unlockBtn.click();
        await page.waitForTimeout(500);
        console.log('Unlock button clicked');
      } else {
        console.log('Unlock button not found');
      }

      // Test ban button
      console.log('\n=== Test 7: Ban user ===');
      const banBtn = await page.locator('button:has-text("封禁")').first();
      if (await banBtn.count() > 0) {
        await banBtn.click();
        await page.waitForTimeout(500);
        console.log('Ban button clicked');
      } else {
        console.log('Ban button not found');
      }
    }

    console.log('\n=== All tests completed ===');
  } catch (err) {
    console.error('Test error:', err.message);
  } finally {
    await browser.close();
  }
})();