import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { User } from '@/types';
import { authApi } from '../api/authApi';

const TOKEN_KEY = 'access_token';
const USER_KEY = 'auth_user';

interface AuthState {
  token: string | null;
  user: User | null;
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function loadToken(): string | null {
  if (!canUseStorage()) return null;
  return localStorage.getItem(TOKEN_KEY);
}

function loadUser(): User | null {
  if (!canUseStorage()) return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as User;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

function persistSession(token: string | null, user: User | null) {
  if (!canUseStorage()) return;

  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }

  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
}

const persistedToken = loadToken();

const initialState: AuthState = {
  token: persistedToken,
  user: persistedToken ? loadUser() : null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ token: string; user: User }>) {
      state.token = action.payload.token;
      state.user = action.payload.user;
      persistSession(action.payload.token, action.payload.user);
    },
    patchSessionUser(state, action: PayloadAction<Partial<Pick<User, 'name' | 'email' | 'login' | 'mustChangePassword'>>>) {
      if (!state.user) return;
      state.user = { ...state.user, ...action.payload };
      persistSession(state.token, state.user);
    },
    logout(state) {
      state.token = null;
      state.user = null;
      persistSession(null, null);
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(authApi.endpoints.getMe.matchFulfilled, (state, action) => {
      state.user = action.payload;
      persistSession(state.token, action.payload);
    });
    builder.addMatcher(authApi.endpoints.getMe.matchRejected, (state) => {
      state.token = null;
      state.user = null;
      persistSession(null, null);
    });
  },
});

export const { setCredentials, patchSessionUser, logout } = authSlice.actions;
export default authSlice.reducer;
