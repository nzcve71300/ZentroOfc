import { AuthUser } from '../types';

export const mockCurrentUser: AuthUser = {
  ign: "TestUser",
  email: "testuser@zentro.gg",
  token: "mock_jwt_token_12345"
};

export const mockBalance = {
  current: 2450,
  currency: "Zentro Coins"
};