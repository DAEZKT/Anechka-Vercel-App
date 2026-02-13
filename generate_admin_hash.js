const bcrypt = require('bcryptjs');

const password = '1987';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, function (err, hash) {
    if (err) {
        console.error('Error hashing password:', err);
        return;
    }
    console.log(`Password: ${password}`);
    console.log(`Hash: ${hash}`);
});
