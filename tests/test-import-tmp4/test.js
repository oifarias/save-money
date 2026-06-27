const { chromium } = require('playwright');
const path = require('path');

const BASE = 'http://localhost:3000';
const EMAIL = `import-feat-${Date.now()}@example.com`;
const PASSWORD = 'SenhaTeste123!';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

  try {
    await page.goto(`${BASE}/cadastro`);
    await page.fill('input[name="name"]', 'Import Feature User');
    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/login/, { timeout: 15000 });
    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard/, { timeout: 15000 });

    await page.goto(`${BASE}/importar`);
    await page.waitForSelector('text=Selecionar arquivo');

    console.log('--- Upload via clique real no botão ---');
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('button:has-text("Selecionar arquivo")'),
    ]);
    await fileChooser.setFiles(path.resolve('test-import-tmp4/planilha-40linhas.xlsx'));
    await page.waitForSelector('text=Resumo da importação', { timeout: 15000 });
    console.log('Prévia carregada');

    // --- Paginação ---
    console.log('--- Testando paginação ---');
    const pageIndicator = await page.locator('text=/Página \\d+ de \\d+/').innerText();
    console.log('Indicador inicial:', pageIndicator);
    const firstPageFirstRowDesc = await page.locator('tbody tr').first().locator('td').nth(2).innerText();
    await page.click('button:has-text("Próxima")');
    await page.waitForTimeout(300);
    const secondPageIndicator = await page.locator('text=/Página \\d+ de \\d+/').innerText();
    const secondPageFirstRowDesc = await page.locator('tbody tr').first().locator('td').nth(2).innerText();
    console.log('Indicador após "Próxima":', secondPageIndicator);
    console.log('Linha mudou?', firstPageFirstRowDesc !== secondPageFirstRowDesc, firstPageFirstRowDesc, '->', secondPageFirstRowDesc);
    await page.click('button:has-text("Anterior")');
    await page.waitForTimeout(300);

    // --- Filtro "Com erro" ---
    console.log('--- Testando filtro "Com erro" ---');
    await page.click('button:has-text("Com erro")');
    await page.waitForTimeout(300);
    const rowsAfterErrorFilter = await page.locator('tbody tr').count();
    const errorBadges = await page.locator('tbody tr td:has-text("Sub-categoria")').count();
    console.log('Linhas visíveis após filtro erro:', rowsAfterErrorFilter, '(esperado 2)');
    await page.screenshot({ path: 'test-import-tmp4/filtro-erro.png', fullPage: true });

    console.log('--- Limpar filtro ---');
    await page.click('text=Limpar filtro');
    await page.waitForTimeout(300);

    // --- Edição inline de categoria ---
    console.log('--- Testando edição inline de categoria ---');
    await page.click('button:has-text("Com erro")');
    await page.waitForTimeout(300);
    const firstErrorRow = page.locator('tbody tr').first();
    await firstErrorRow.locator('td').nth(5).locator('button').click(); // categoria cell
    await page.waitForTimeout(200);
    const input = firstErrorRow.locator('td').nth(5).locator('input');
    await input.fill('Categoria Corrigida');
    await input.press('Enter');
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-import-tmp4/apos-edicao.png', fullPage: true });
    const summaryAfterEdit = await page.locator('text=Com erro').locator('xpath=following-sibling::span').first().innerText().catch(() => 'n/a');
    console.log('Editou categoria, tirou screenshot apos-edicao.png');

    await page.click('text=Limpar filtro');
    await page.waitForTimeout(300);

    // --- Remover linha ---
    console.log('--- Testando remoção de linha ---');
    const rowCountBefore = await page.locator('tbody tr').count();
    await page.locator('tbody tr').first().locator('button[aria-label="Remover linha"]').click();
    await page.waitForTimeout(300);
    const rowCountAfter = await page.locator('tbody tr').count();
    const removedText = await page.locator('text=/removida/').innerText().catch(() => 'NAO ENCONTRADO');
    console.log('Linhas antes:', rowCountBefore, 'depois:', rowCountAfter, '| texto removida:', removedText);

    await page.screenshot({ path: 'test-import-tmp4/final.png', fullPage: true });

    console.log('--- Erros JS capturados ---', JSON.stringify(errors));
    console.log('TEST_EMAIL=' + EMAIL);
  } catch (err) {
    console.error('FALHOU:', err.message);
    await page.screenshot({ path: 'test-import-tmp4/erro.png', fullPage: true }).catch(() => {});
    console.log('--- Erros JS no momento da falha ---', JSON.stringify(errors));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
