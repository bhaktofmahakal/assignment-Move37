const validator = require('validator');
const xss = require('xss');

// Sanitize string input
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  
  // Remove XSS attempts
  let sanitized = xss(str, {
    whiteList: {}, // No HTML tags allowed
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script']
  });
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ');
  
  return sanitized;
};

// Validate and sanitize email
const sanitizeEmail = (email) => {
  if (typeof email !== 'string') return null;
  
  const normalized = validator.normalizeEmail(email);
  return validator.isEmail(normalized) ? normalized : null;
};

// Validate password strength
const validatePassword = (password) => {
  if (typeof password !== 'string') return false;
  
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

// Sanitize object recursively
const sanitizeObject = (obj) => {
  if (obj === null || obj === undefined) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[sanitizeString(key)] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  return obj;
};

// Middleware to sanitize request body
const sanitizeInput = (req, res, next) => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  
  next();
};

// Validate specific input types
const validators = {
  name: (name) => {
    if (!name || typeof name !== 'string') return false;
    return name.length >= 2 && name.length <= 50 && /^[a-zA-Z\s]+$/.test(name);
  },
  
  pollQuestion: (question) => {
    if (!question || typeof question !== 'string') return false;
    return question.length >= 5 && question.length <= 500;
  },
  
  pollOption: (option) => {
    if (!option || typeof option !== 'string') return false;
    return option.length >= 1 && option.length <= 100;
  },
  
  uuid: (id) => {
    if (!id || typeof id !== 'string') return false;
    return validator.isUUID(id, 4) || /^[a-zA-Z0-9_-]+$/.test(id); // Allow cuid format too
  }
};

// Validation middleware for specific routes
const validateUserRegistration = (req, res, next) => {
  const { name, email, password } = req.body;
  const errors = [];
  
  if (!validators.name(name)) {
    errors.push('Name must be 2-50 characters and contain only letters and spaces');
  }
  
  if (!sanitizeEmail(email)) {
    errors.push('Please provide a valid email address');
  }
  
  if (!validatePassword(password)) {
    errors.push('Password must be at least 8 characters with uppercase, lowercase, and number');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join('; ') });
  }
  
  // Update sanitized values
  req.body.email = sanitizeEmail(email);
  
  next();
};

const validatePollCreation = (req, res, next) => {
  const { question, options } = req.body;
  const errors = [];
  
  if (!validators.pollQuestion(question)) {
    errors.push('Question must be 5-500 characters');
  }
  
  if (!Array.isArray(options) || options.length < 2 || options.length > 10) {
    errors.push('Poll must have 2-10 options');
  } else {
    options.forEach((option, index) => {
      if (!validators.pollOption(option)) {
        errors.push(`Option ${index + 1} must be 1-100 characters`);
      }
    });
  }
  
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join('; ') });
  }
  
  next();
};

const validateVote = (req, res, next) => {
  const { pollOptionId } = req.body;
  
  if (!validators.uuid(pollOptionId)) {
    return res.status(400).json({ error: 'Invalid poll option ID' });
  }
  
  next();
};

module.exports = {
  sanitizeInput,
  sanitizeString,
  sanitizeEmail,
  validatePassword,
  validators,
  validateUserRegistration,
  validatePollCreation,
  validateVote
};