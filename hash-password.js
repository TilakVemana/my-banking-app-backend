const bcrypt = require('bcryptjs');
const password = 'admin';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('Error hashing password:', err);
    return;
  }
  console.log('--- New Admin Password Hash ---');
  console.log('Copy the hash value below (the line starting with $2a$):');
  console.log(hash);
  console.log('\n--- SQL Command to Fix Database ---');
  console.log('Run this command in your SQL tool:');
  console.log(`UPDATE accounts SET password = '${hash}' WHERE username = 'admin';`);
});