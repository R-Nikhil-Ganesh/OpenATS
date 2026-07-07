const bcrypt = require('bcryptjs');
const hash = '$2y$12$N9mB7Qo.5wHwU./6fU7xO.e/e9wYc5b5n9/N.0v.h.8jD7L.g.Y6W';
const pw = 'admin';
bcrypt.compare(pw, hash, (err, res) => {
  console.log('Result:', res, 'Error:', err);
});
