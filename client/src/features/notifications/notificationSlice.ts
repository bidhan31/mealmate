import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { notificationApi } from '@/api/financeApi';
import type { AuthUser } from '@/types/auth';

// ── All 28 notification types mirrored from the server enum ──────────────────
export const ALL_NOTIFICATION_TYPES = [
  // Meal & Food
  'meal_cutoff_warning',
  'meal_modified_by_admin',
  'guest_meal_requested',
  'guest_meal_resolved',
  'food_turn',
  'new_food_purchase',
  'food_purchase_status_changed',
  // Financial
  'new_due',
  'deposit_recorded',
  'deposit_status_changed',
  'new_expense_added',
  'expense_status_changed',
  'wallet_balance_updated',
  'low_wallet_balance',
  'refund_recorded',
  // Member Events
  'member_joined',
  'member_left',
  'member_removed',
  'join_request_submitted',
  'join_request_approved',
  'join_request_rejected',
  'invitation_received',
  'admin_role_transferred',
  // Home & System
  'month_closed',
  'home_settings_updated',
  'room_assigned',
  'room_rent_updated',
  'admin_override',
] as const;

export type NotificationType = (typeof ALL_NOTIFICATION_TYPES)[number];

/** Build a fully-populated prefs object from a sparse server record. */
function buildFullPrefs(sparse: Record<string, boolean> = {}): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const t of ALL_NOTIFICATION_TYPES) {
    result[t] = sparse[t] !== false; // absent or true = opted-in
  }
  return result;
}

// ── State ────────────────────────────────────────────────────────────────────

interface NotificationState {
  prefs: Record<string, boolean>;
  status: 'idle' | 'loading' | 'saving' | 'error';
  error: string | null;
}

const initialState: NotificationState = {
  prefs: buildFullPrefs(),
  status: 'idle',
  error: null,
};

// ── Thunks ───────────────────────────────────────────────────────────────────

export const loadPrefs = createAsyncThunk(
  'notifications/loadPrefs',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await notificationApi.getPrefs();
      return data.data.prefs;
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      return rejectWithValue(e.response?.data?.message ?? 'Failed to load notification preferences');
    }
  },
);

export const savePrefs = createAsyncThunk(
  'notifications/savePrefs',
  async (prefs: Record<string, boolean>, { rejectWithValue }) => {
    try {
      const { data } = await notificationApi.updatePrefs(prefs);
      return data.data.prefs;
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      return rejectWithValue(e.response?.data?.message ?? 'Failed to save notification preferences');
    }
  },
);

// ── Slice ────────────────────────────────────────────────────────────────────

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    /** Called on login/me to seed prefs from the user payload without a network round-trip. */
    seedPrefsFromUser(state, action: PayloadAction<AuthUser>) {
      state.prefs = buildFullPrefs(action.payload.notificationPrefs ?? {});
      state.status = 'idle';
    },
    /** Optimistic local update (used while the save thunk is in-flight). */
    setPref(state, action: PayloadAction<{ type: string; value: boolean }>) {
      state.prefs[action.payload.type] = action.payload.value;
    },
    resetPrefs(state) {
      state.prefs = buildFullPrefs();
      state.status = 'idle';
    },
  },
  extraReducers: (builder) => {
    builder
      // Load
      .addCase(loadPrefs.pending, (s) => { s.status = 'loading'; s.error = null; })
      .addCase(loadPrefs.fulfilled, (s, a) => {
        s.prefs = buildFullPrefs(a.payload);
        s.status = 'idle';
      })
      .addCase(loadPrefs.rejected, (s, a) => { s.status = 'error'; s.error = a.payload as string; })

      // Save
      .addCase(savePrefs.pending, (s) => { s.status = 'saving'; s.error = null; })
      .addCase(savePrefs.fulfilled, (s, a) => {
        s.prefs = buildFullPrefs(a.payload);
        s.status = 'idle';
      })
      .addCase(savePrefs.rejected, (s, a) => { s.status = 'error'; s.error = a.payload as string; });
  },
});

export const { seedPrefsFromUser, setPref, resetPrefs } = notificationSlice.actions;
export default notificationSlice.reducer;
