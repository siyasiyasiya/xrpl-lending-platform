// backend/src/middleware/validate.js

const { validationResult } = require('express-validator');

const validate = (req, res, next) => {
  // Gathers all validation errors from the request
  const errors = validationResult(req);

  // If there are errors, stop the request and send a 400 error with the details
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // If there are no errors, proceed to the next middleware or the main route handler
  next();
};

module.exports = validate;