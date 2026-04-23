import { AuthService } from '@ghostfolio/api/app/auth/auth.service';
import { UserService } from '@ghostfolio/api/app/user/user.service';
import { ConfigurationService } from '@ghostfolio/api/services/configuration/configuration.service';

import { JwtService } from '@nestjs/jwt';

describe('AuthService', () => {
  let authService: AuthService;
  let configurationService: ConfigurationService;
  let jwtService: JwtService;
  let userService: UserService;

  const MOCK_ACCESS_TOKEN_SALT = 'test-salt';
  const MOCK_HASHED_TOKEN = 'hashed-access-token';
  const MOCK_JWT = 'signed-jwt-token';
  const MOCK_USER = { id: 'user-id-123' };

  beforeEach(() => {
    configurationService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'ACCESS_TOKEN_SALT') {
          return MOCK_ACCESS_TOKEN_SALT;
        }
        return undefined;
      })
    } as unknown as ConfigurationService;

    jwtService = {
      sign: jest.fn().mockReturnValue(MOCK_JWT)
    } as unknown as JwtService;

    userService = {
      createAccessToken: jest.fn().mockReturnValue(MOCK_HASHED_TOKEN),
      users: jest.fn().mockResolvedValue([MOCK_USER])
    } as unknown as UserService;

    authService = new AuthService(
      configurationService,
      jwtService,
      // PropertyService is not used by validateAnonymousLogin
      null,
      userService
    );
  });

  describe('validateAnonymousLogin', () => {
    it('should return a JWT for a valid access token', async () => {
      const result = await authService.validateAnonymousLogin('valid-token');

      expect(userService.createAccessToken).toHaveBeenCalledWith({
        password: 'valid-token',
        salt: MOCK_ACCESS_TOKEN_SALT
      });

      expect(userService.users).toHaveBeenCalledWith({
        where: { accessToken: MOCK_HASHED_TOKEN }
      });

      expect(jwtService.sign).toHaveBeenCalledWith({ id: MOCK_USER.id });
      expect(result).toBe(MOCK_JWT);
    });

    it('should throw when no user matches the token', async () => {
      (userService.users as jest.Mock).mockResolvedValue([]);

      await expect(
        authService.validateAnonymousLogin('invalid-token')
      ).rejects.toThrow();

      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('should throw when an empty token is provided', async () => {
      (userService.users as jest.Mock).mockResolvedValue([]);

      await expect(authService.validateAnonymousLogin('')).rejects.toThrow();

      expect(userService.createAccessToken).toHaveBeenCalledWith({
        password: '',
        salt: MOCK_ACCESS_TOKEN_SALT
      });
    });

    it('should hash the token with the configured salt', async () => {
      await authService.validateAnonymousLogin('my-secret-token');

      expect(configurationService.get).toHaveBeenCalledWith(
        'ACCESS_TOKEN_SALT'
      );

      expect(userService.createAccessToken).toHaveBeenCalledWith({
        password: 'my-secret-token',
        salt: MOCK_ACCESS_TOKEN_SALT
      });
    });

    it('should propagate errors from userService.users', async () => {
      const dbError = new Error('Database connection failed');
      (userService.users as jest.Mock).mockRejectedValue(dbError);

      await expect(
        authService.validateAnonymousLogin('any-token')
      ).rejects.toThrow('Database connection failed');
    });

    it('should sign the JWT with only the user id', async () => {
      const userWithExtraFields = {
        id: 'user-456',
        email: 'test@example.com',
        name: 'Test User'
      };
      (userService.users as jest.Mock).mockResolvedValue([userWithExtraFields]);

      await authService.validateAnonymousLogin('valid-token');

      // Only the id should be in the JWT payload
      expect(jwtService.sign).toHaveBeenCalledWith({ id: 'user-456' });
    });
  });
});
