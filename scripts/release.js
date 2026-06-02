import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { execSync } from 'child_process';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

function runCmd(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch (err) {
    console.error(`Error running command: ${cmd}\n`, err.stderr || err.message);
    process.exit(1);
  }
}

async function main() {
  console.log('=== ShadowMod Release Cutter ===\n');

  // 1. Check Git Status
  const status = runCmd('git status --porcelain');
  if (status) {
    console.error('Aborting: Git working directory is not clean. Please commit or stash changes first.\n');
    console.error(status);
    process.exit(1);
  }

  // 2. Read current version
  const packageJsonPath = path.resolve('package.json');
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const currentVersion = pkg.version;
  console.log(`Current version: ${currentVersion}`);

  // Calculate standard bumps
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  const nextPatch = `${major}.${minor}.${patch + 1}`;
  const nextMinor = `${major}.${minor + 1}.0`;
  const nextMajor = `${major + 1}.0.0`;

  // 3. Prompt for release bump type
  console.log('Select release type:');
  console.log(`  1) patch: ${nextPatch} (bug fixes, no schema changes)`);
  console.log(`  2) minor: ${nextMinor} (new features, backward-compatible schema changes)`);
  console.log(`  3) major: ${nextMajor} (breaking changes, major rewrites)`);
  console.log('  4) custom version string');
  
  const choice = await question('Enter choice (1-4): ');
  let targetVersion = '';
  if (choice === '1') {
    targetVersion = nextPatch;
  } else if (choice === '2') {
    targetVersion = nextMinor;
  } else if (choice === '3') {
    targetVersion = nextMajor;
  } else if (choice === '4') {
    targetVersion = (await question('Enter custom version (e.g. 1.2.3): ')).trim();
  } else {
    console.error('Invalid choice. Aborting.');
    process.exit(1);
  }

  if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(targetVersion)) {
    console.error(`Invalid version string: "${targetVersion}". Aborting.`);
    process.exit(1);
  }

  // 4. Validate CHANGELOG.md has unreleased notes
  const changelogPath = path.resolve('CHANGELOG.md');
  const changelog = fs.readFileSync(changelogPath, 'utf8');
  
  const unreleasedMatch = changelog.match(/##\s*\[Unreleased\]([\s\S]*?)(##\s*\[|$)/);
  if (!unreleasedMatch) {
    console.error('Aborting: Could not find "## [Unreleased]" section in CHANGELOG.md.');
    process.exit(1);
  }

  const unreleasedContent = unreleasedMatch[1].replace(/[\r\n-\s]+/g, '').trim();
  if (!unreleasedContent) {
    console.error('Aborting: "## [Unreleased]" section in CHANGELOG.md is empty. Please add release notes first.');
    process.exit(1);
  }

  // 5. Ask for confirmation
  const confirm = await question(`Cut release v${targetVersion}? (y/n): `);
  if (confirm.toLowerCase() !== 'y') {
    console.log('Aborting release.');
    process.exit(0);
  }

  console.log('\nProcessing files...');

  // 6. Update package.json version
  pkg.version = targetVersion;
  fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');

  // 7. Update CHANGELOG.md
  // Format matching current style: ## [1.1.0] — 2026-05-26
  const dateStr = new Date().toISOString().slice(0, 10);
  const newHeader = `## [Unreleased]\n\n---\n\n## [${targetVersion}] — ${dateStr}`;
  const updatedChangelog = changelog.replace('## [Unreleased]', newHeader);
  fs.writeFileSync(changelogPath, updatedChangelog);

  // 8. Run sanity checks & code verification
  console.log('Running validation checks (pnpm run check)...');
  try {
    execSync('pnpm run check', { stdio: 'inherit' });
  } catch {
    console.error('\nChecks failed. Reverting changes...');
    // Revert changes
    fs.writeFileSync(packageJsonPath, JSON.stringify(JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')), null, 2) + '\n');
    fs.writeFileSync(changelogPath, changelog);
    console.log('Reverted package.json and CHANGELOG.md.');
    process.exit(1);
  }

  // 9. Git commit and tag
  console.log('\nCommitting and tagging in git...');
  runCmd('git add package.json CHANGELOG.md');
  runCmd(`git commit -m "chore: release v${targetVersion}"`);
  runCmd(`git tag v${targetVersion}`);

  console.log(`\n🎉 Success! Release v${targetVersion} cut locally.`);
  console.log(`Run the following command to push changes and trigger the automated release/publishing:\n`);
  console.log(`  git push origin v${targetVersion} && git push\n`);

  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
