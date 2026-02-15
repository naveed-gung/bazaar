const { AppError, NotFoundError, ValidationError, AuthorizationError } = require('../../src/utils/errors');

describe('Custom Error Classes', () => {
  describe('AppError', () => {
    it('should create an error with message and statusCode', () => {
      const error = new AppError('Something went wrong', 500);
      expect(error.message).toBe('Something went wrong');
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
      expect(error).toBeInstanceOf(Error);
    });

    it('should default isOperational to true', () => {
      const error = new AppError('Test', 400);
      expect(error.isOperational).toBe(true);
    });
  });

  describe('NotFoundError', () => {
    it('should create a 404 error', () => {
      const error = new NotFoundError('Product');
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Product not found');
      expect(error).toBeInstanceOf(AppError);
    });

    it('should default message to "Resource not found"', () => {
      const error = new NotFoundError();
      expect(error.message).toBe('Resource not found');
    });
  });

  describe('ValidationError', () => {
    it('should create a 400 error', () => {
      const error = new ValidationError('Invalid email');
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Invalid email');
      expect(error).toBeInstanceOf(AppError);
    });

    it('should default message to "Validation failed"', () => {
      const error = new ValidationError();
      expect(error.message).toBe('Validation failed');
    });
  });

  describe('AuthorizationError', () => {
    it('should create a 403 error', () => {
      const error = new AuthorizationError('No access');
      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('No access');
      expect(error).toBeInstanceOf(AppError);
    });

    it('should default message to "Not authorized"', () => {
      const error = new AuthorizationError();
      expect(error.message).toBe('Not authorized');
    });
  });
});
