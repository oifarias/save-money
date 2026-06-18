const { chromium } = require('playwright');
const path = require('path');

const BASE = 'http://localhost:3000';
const EMAIL = `import-test-${Date.now()}@example.com`;
const PASSWORD = 'SenhaTeste123!';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));

  try {
    console.log('--- Cadastro ---');
    await page.goto(`${BASE}/cadastro`);
    await page.waitForSelector('form');
    await page.fill('input[name="name"]', 'Import Test User');
    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="password"]', PASSWORD);
    const confirmField = await page.$('input[name="confirmPassword"]');
    if (confirmField) await confirmField.fill(PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/login/, { timeout: 15000 });
    console.log('Cadastro OK, redirecionado para', page.url());

    console.log('--- Login ---');
    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard/, { timeout: 15000 });
    console.log('Login OK, em', page.url());

    console.log('--- Navegar para /importar ---');
    await page.goto(`${BASE}/importar`);
    await page.waitForSelector('text=Envie sua planilha');
    await page.screenshot({ path: 'test-import-tmp/01-upload.png' });

    console.log('--- Upload do arquivo ---');
    const fileInput = await page.$('#import-file-input');
    await fileInput.setInputFiles(path.resolve('test-import-tmp/planilha-teste.xlsx'));

    await page.waitForSelector('text=Resumo da importação', { timeout: 15000 });
    await page.screenshot({ path: 'test-import-tmp/02-preview.png', fullPage: true });
    console.log('Prévia carregada');

    const summaryText = await page.locator('text=Resumo da importação').locator('xpath=ancestor::div[contains(@class,"flex")][1]').first().innerText().catch(() => null);

    // Extract summary stats via the stat cards
    const stats = await page.$$eval('div:has(> span.text-xs)', (nodes) =>
      nodes
        .map((n) => {
          const label = n.querySelector('span')?.textContent?.trim();
          const value = n.querySelectorAll('span')[1]?.textContent?.trim();
          return { label, value };
        })
        .filter((s) => s.label && s.value)
    );
    console.log('Stats encontrados na tela:', JSON.stringify(stats, null, 2));

    console.log('--- Confirmar importação ---');
    const importButton = page.locator('button:has-text("Importar")').first();
    await importButton.click();

    await page.waitForSelector('text=Importação concluída', { timeout: 20000 });
    const resultText = await page.locator('p:has-text("lançamento(s) importado")').innerText();
    console.log('Resultado:', resultText);
    await page.screenshot({ path: 'test-import-tmp/03-result.png' });

    console.log('--- Verificar /lancamentos ---');
    await page.goto(`${BASE}/lancamentos`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-import-tmp/04-lancamentos.png', fullPage: true });

    const rows = await page.$$eval('table tbody tr, [data-testid="transaction-row"]', (els) =>
      els.map((el) => el.textContent.replace(/\s+/g, ' ').trim())
    );
    console.log('Linhas em /lancamentos:', JSON.stringify(rows, null, 2));

    console.log('--- Console errors ---', JSON.stringify(consoleErrors, null, 2));
    console.log('TEST_EMAIL=' + EMAIL);
  } catch (err) {
    console.error('FALHOU:', err);
    await page.screenshot({ path: 'test-import-tmp/error.png', fullPage: true }).catch(() => {});
    console.log('--- Console errors at failure ---', JSON.stringify(consoleErrors, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
