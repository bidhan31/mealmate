import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { authApi } from '@/api/authApi';
import { tokenStore } from '@/lib/tokenStore';
import type { AuthUser } from '@/types/auth';

interface AuthState {
  user: AuthUser | null;
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  error: string | null;
  pendingGoogleIdToken: string | null;
}

const initialState: AuthState = {
  user: null,
  status: 'idle',
  error: null,
  pendingGoogleIdToken: null,
};

function extractError(err: unknown): string {
  const e = err as { response?: { data?: { message?: string } } };
  return e.response?.data?.message ?? 'Something went wrong';
}

export const login = createAsyncThunk(
  'auth/login',
  async (payload: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const { data } = await authApi.login(payload.email, payload.password);
      tokenStore.set(data.data.accessToken, data.data.refreshToken);
      return data.data.user;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
);

export const googleLogin = createAsyncThunk(
  'auth/googleLogin',
  async (payload: { idToken: string; name?: string }, { rejectWithValue }) => {
    try {
      const { data } = await authApi.google(payload.idToken, payload.name);
      tokenStore.set(data.data.accessToken, data.data.refreshToken);
      return { user: data.data.user, needsName: data.data.needsName ?? false, idToken: payload.idToken };
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
);

export const loadCurrentUser = createAsyncThunk(
  'auth/loadCurrentUser',
  async (_: void, { rejectWithValue }) => {
    if (!tokenStore.getAccess()) return rejectWithValue('No session');
    try {
      const { data } = await authApi.me();
      return data.data.user;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
);

export const logout = createAsyncThunk('auth/logout', async () => {
  const refresh = tokenStore.getRefresh();
  if (refresh) {
    try {
      await authApi.logout(refresh);
    } catch {
      // ignore network errors on logout
    }
  }
  tokenStore.clear();
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<AuthUser>) {
      state.user = action.payload;
      state.status = 'authenticated';
    },
    clearPendingGoogle(state) {
      state.pendingGoogleIdToken = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // ── Login ──────────────────────────────────────────────────────────
      .addCase(login.pending, (s) => { s.status = 'loading'; s.error = null; })
      .addCase(login.fulfilled, (s, a) => {
        s.user = a.payload;
        s.status = 'authenticated';
        s.error = null;
      })
      .addCase(login.rejected, (s, a) => { s.status = 'unauthenticated'; s.error = a.payload as string; })

      // ── Google Login ───────────────────────────────────────────────────
      .addCase(googleLogin.pending, (s) => { s.status = 'loading'; s.error = null; })
      .addCase(googleLogin.fulfilled, (s, a) => {
        if (a.payload.needsName) {
          s.status = 'unauthenticated';
          s.pendingGoogleIdToken = a.payload.idToken;
        } else {
          s.user = a.payload.user;
          s.status = 'authenticated';
          s.pendingGoogleIdToken = null;
        }
      })
      .addCase(googleLogin.rejected, (s, a) => { s.status = 'unauthenticated'; s.error = a.payload as string; })

      // ── Load Current User ──────────────────────────────────────────────
      .addCase(loadCurrentUser.pending, (s) => { s.status = 'loading'; })
      .addCase(loadCurrentUser.fulfilled, (s, a) => {
        s.user = a.payload;
        s.status = 'authenticated';
      })
      .addCase(loadCurrentUser.rejected, (s) => {
        tokenStore.clear();
        s.user = null;
        s.status = 'unauthenticated';
      })

      // ── Logout ────────────────────────────────────────────────────────
      .addCase(logout.fulfilled, (s) => {
        s.user = null;
        s.status = 'unauthenticated';
        s.pendingGoogleIdToken = null;
      });
  },
});

export const { setUser, clearPendingGoogle } = authSlice.actions;
export default authSlice.reducer;
