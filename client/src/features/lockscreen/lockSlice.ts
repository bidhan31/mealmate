import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { authApi } from '@/api/authApi';
import type { AuthUser } from '@/types/auth';

interface LockState {
  /** Mirrors user.isAppLocked — updated whenever the server returns a fresh user object */
  isLocked: boolean;
  /** True if user.hasLockPin — i.e. a PIN is configured on the server */
  isEnabled: boolean;
  /** Minutes of inactivity before auto-lock (mirrors user.lockTimeoutMin) */
  timeoutMin: number;
}

const initialState: LockState = {
  isLocked: false,
  isEnabled: false,
  timeoutMin: 5,
};

/** Sync lock slice from a freshly-received AuthUser (called after any auth API response). */
export function syncLockFromUser(state: LockState, user: AuthUser) {
  state.isLocked = user.isAppLocked;
  state.isEnabled = user.hasLockPin;
  state.timeoutMin = user.lockTimeoutMin;
}

// ── Async thunks ─────────────────────────────────────────────────────────────

export const serverLockApp = createAsyncThunk(
  'lock/lockApp',
  async (_: void, { rejectWithValue }) => {
    try {
      const { data } = await authApi.lockApp();
      return data.data.user;
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      return rejectWithValue(e.response?.data?.message ?? 'Failed to lock');
    }
  },
);

export const serverUnlockApp = createAsyncThunk(
  'lock/unlockApp',
  async (pin: string, { rejectWithValue }) => {
    try {
      const { data } = await authApi.unlockApp(pin);
      return data.data.user;
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      return rejectWithValue(e.response?.data?.message ?? 'Incorrect PIN');
    }
  },
);

export const serverSetLockPin = createAsyncThunk(
  'lock/setLockPin',
  async (payload: { pin: string; timeoutMin?: number }, { rejectWithValue }) => {
    try {
      const { data } = await authApi.setLockPin(payload.pin, payload.timeoutMin);
      return data.data.user;
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      return rejectWithValue(e.response?.data?.message ?? 'Failed to set PIN');
    }
  },
);

export const serverRemoveLockPin = createAsyncThunk(
  'lock/removeLockPin',
  async (_: void, { rejectWithValue }) => {
    try {
      const { data } = await authApi.removeLockPin();
      return data.data.user;
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      return rejectWithValue(e.response?.data?.message ?? 'Failed to remove lock');
    }
  },
);

export const serverUpdateLockSettings = createAsyncThunk(
  'lock/updateSettings',
  async (timeoutMin: number, { rejectWithValue }) => {
    try {
      const { data } = await authApi.updateLockSettings(timeoutMin);
      return data.data.user;
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      return rejectWithValue(e.response?.data?.message ?? 'Failed to update settings');
    }
  },
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const lockSlice = createSlice({
  name: 'lock',
  initialState,
  reducers: {
    /** Called immediately (optimistically) when a fresh user object is loaded from any auth call. */
    syncFromUser(state, action: { payload: AuthUser }) {
      syncLockFromUser(state, action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(serverLockApp.fulfilled, (state, action) => {
        syncLockFromUser(state, action.payload);
      })
      .addCase(serverUnlockApp.fulfilled, (state, action) => {
        syncLockFromUser(state, action.payload);
      })
      .addCase(serverSetLockPin.fulfilled, (state, action) => {
        syncLockFromUser(state, action.payload);
      })
      .addCase(serverRemoveLockPin.fulfilled, (state, action) => {
        syncLockFromUser(state, action.payload);
      })
      .addCase(serverUpdateLockSettings.fulfilled, (state, action) => {
        syncLockFromUser(state, action.payload);
      });
  },
});

export const { syncFromUser } = lockSlice.actions;
export default lockSlice.reducer;
