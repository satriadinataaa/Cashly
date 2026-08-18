const bcrypt = require('bcryptjs');

async function main() {
  const password = process.argv[2];
  if (!password || password.length < 12) {
    throw new Error('Gunakan password admin minimal 12 karakter.');
  }
  console.log(await bcrypt.hash(password, 12));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
