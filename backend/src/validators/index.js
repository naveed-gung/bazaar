const { ValidationError } = require('../utils/errors');

/**
 * Express middleware factory that validates req.body against a Joi schema.
 * Usage: router.post('/route', validate(schemas.auth.register), controller.fn)
 */
function validate(schema, property = 'body') {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const messages = error.details.map(d => d.message);
      return next(new ValidationError(messages.join('; '), messages));
    }

    // Replace with sanitized values
    req[property] = value;
    next();
  };
}

module.exports = { validate };
