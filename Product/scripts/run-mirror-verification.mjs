import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

const PORT = 5173;
const URL = `http://localhost:${PORT}/dev/mirror-verification`;

async function run() {
  console.log('Starting dev server...');
  const server = spawn('npm', ['run', 'dev'], { stdio: 'pipe', shell: true });
  
  await new Promise(resolve => setTimeout(resolve, 3000)); // wait for vite
  
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`BROWSER: ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.error(`BROWSER ERROR: ${err.message}`);
  });

  console.log(`Navigating to ${URL}...`);
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });

  console.log('Waiting for verification matches to finish (this plays 2 full chess games, please wait up to 2 mins)...');
  
  try {
    await page.waitForFunction(
      () => !!window.__VERIFICATION_RESULTS__,
      { timeout: 120_000 }
    );
    
    const results = await page.evaluate(() => window.__VERIFICATION_RESULTS__);
    
    const scratchDir = join(process.cwd(), 'scratch');
    if (!existsSync(scratchDir)) {
      mkdirSync(scratchDir);
    }
    
    const whitePath = join(scratchDir, 'latest-match-white.json');
    const blackPath = join(scratchDir, 'latest-match-black.json');
    
    writeFileSync(whitePath, JSON.stringify(results.white, null, 2));
    writeFileSync(blackPath, JSON.stringify(results.black, null, 2));
    
    console.log(`\nSaved matches to:`);
    console.log(`- ${whitePath}`);
    console.log(`- ${blackPath}\n`);
    
    await browser.close();
    server.kill();
    
    console.log('Analyzing White Match...');
    await runAnalysis(whitePath);
    
    console.log('\nAnalyzing Black Match...');
    await runAnalysis(blackPath);
    
    process.exit(0);
  } catch (err) {
    console.error('Verification failed or timed out:', err);
    await browser.close();
    server.kill();
    process.exit(1);
  }
}

async function runAnalysis(matchPath) {
  return new Promise((resolve, reject) => {
    const analyzer = spawn('node', ['scripts/analyze_mirror_match.mjs', matchPath], { stdio: 'inherit', shell: true });
    analyzer.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`Analyzer exited with code ${code}`));
    });
  });
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
