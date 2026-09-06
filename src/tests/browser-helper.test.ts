import { expect, test } from 'bun:test';
import { chromeExecutablePath, dataSelector, launchBrowser } from './browser-helper';

(chromeExecutablePath() ? test : test.skip)('browser selectors match literal Windows paths and quoted project names', async () => {
  const bunPath = process.execPath;
  const browser = await launchBrowser();
  try {
    expect(process.execPath).toBe(bunPath);
    const page = await browser.newPage();
    const values = ['C:\\Users\\runner\\Project one::ins-1', '/tmp/项目 "quoted"/one', "C:\\Users\\O'Brien\\project"];
    await page.evaluate(values => {
      for (const value of values) {
        const button = document.createElement('button');
        button.setAttribute('data-project', value);
        button.textContent = value;
        document.body.append(button);
      }
    }, values);
    for (const value of values) {
      const target = page.locator(dataSelector('data-project', value));
      expect(await target.count()).toBe(1);
      expect(await target.getAttribute('data-project')).toBe(value);
      await target.click();
    }
  } finally { await browser.close(); }
}, 15_000);
