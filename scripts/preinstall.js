import { execSync } from 'child_process';

// Allow bypassing for CI/CD if needed
if (process.env.SKIP_QUOKKA_CHECK) {
  process.exit(0);
}

try {
  const email = execSync('git config user.email').toString().trim();
  if (!email || !email.endsWith('@quokkalabs.com')) {
    console.error('\x1b[31m%s\x1b[0m', '❌ ERROR: quokka-fetch is a private package restricted to @quokkalabs.com users.');
    console.error('\x1b[31m%s\x1b[0m', `Your git email is currently set to: ${email || 'not set'}`);
    console.error('\x1b[31m%s\x1b[0m', 'Please configure your git email with: git config --global user.email "your.name@quokkalabs.com"');
    process.exit(1);
  } else {
    console.log('\x1b[32m%s\x1b[0m', `✅ quokka-fetch domain verification passed for: ${email}`);
  }
} catch (error) {
  console.error('\x1b[31m%s\x1b[0m', '❌ ERROR: Unable to verify git email. Ensure git is installed and user.email is configured.');
  console.error('Pre-Install Error : ',error);
  process.exit(1);
}
