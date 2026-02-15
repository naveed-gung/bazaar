// Mock the config module before requiring tokens
jest.mock('../../src/config', () => ({
  jwtSecret: 'test-jwt-secret-key-that-is-at-least-32-characters-long',
  jwtExpiresIn: '15m',
  isProduction: false,
}));

const { generateAccessToken, generateRefreshToken, verifyAccessToken, setRefreshCookie, clearRefreshCookie } = require('../../src/utils/tokens');

describe('Token Utilities', () => {
  describe('generateAccessToken', () => {
    it('should return a JWT string', () => {
      const user = { _id: '507f1f77bcf86cd799439011', role: 'customer' };
      const token = generateAccessToken(user);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include user id and role in payload', () => {
      const user = { _id: '507f1f77bcf86cd799439011', role: 'admin' };
      const token = generateAccessToken(user);
      const payload = verifyAccessToken(token);
      expect(payload.id).toBe(user._id);
      expect(payload.role).toBe('admin');
    });
  });

  describe('generateRefreshToken', () => {
    it('should return an 80-char hex string', () => {
      const token = generateRefreshToken();
      expect(typeof token).toBe('string');
      expect(token).toHaveLength(80); // 40 bytes = 80 hex chars
    });

    it('should generate unique tokens', () => {
      const t1 = generateRefreshToken();
      const t2 = generateRefreshToken();
      expect(t1).not.toBe(t2);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid token', () => {
      const user = { _id: 'abc123', role: 'customer' };
      const token = generateAccessToken(user);
      const payload = verifyAccessToken(token);
      expect(payload.id).toBe('abc123');
    });

    it('should throw on invalid token', () => {
      expect(() => verifyAccessToken('invalid.token.here')).toThrow();
    });

    it('should throw on tampered token', () => {
      const token = generateAccessToken({ _id: 'id', role: 'customer' });
      const tampered = token.slice(0, -5) + 'XXXXX';
      expect(() => verifyAccessToken(tampered)).toThrow();
    });
  });

  describe('setRefreshCookie', () => {
    it('should call res.cookie with httpOnly options', () => {
      const res = { cookie: jest.fn() };
      setRefreshCookie(res, 'test-token');
      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'test-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/api/auth/refresh',
        })
      );
    });
  });

  describe('clearRefreshCookie', () => {
    it('should call res.clearCookie', () => {
      const res = { clearCookie: jest.fn() };
      clearRefreshCookie(res);
      expect(res.clearCookie).toHaveBeenCalledWith(
        'refreshToken',
        expect.objectContaining({ httpOnly: true })
      );
    });
  });
});
