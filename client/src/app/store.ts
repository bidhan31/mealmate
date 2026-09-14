import { configureStore } from '@reduxjs/toolkit';
import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import authReducer, {
  login,
  googleLogin,
  loadCurrentUser,
  logout,
  setUser,
} from '@/features/auth/authSlice';
import homeReducer from '@/features/home/homeSlice';
import lockReducer, { syncFromUser } from '@/features/lockscreen/lockSlice';
import notificationReducer, {
  seedPrefsFromUser,
  resetPrefs,
  loadPrefs,
} from '@/features/notifications/notificationSlice';

// ── Cross-slice listener: sync lock + notification prefs when auth loads a user ─
const listenerMiddleware = createListenerMiddleware();

listenerMiddleware.startListening({
  matcher: isAnyOf(
    login.fulfilled,
    loadCurrentUser.fulfilled,
    googleLogin.fulfilled,
    setUser,
  ),
  effect: (action, listenerApi) => {
    // Extract the user from whichever action fired
    let user: import('@/types/auth').AuthUser | null = null;

    if (login.fulfilled.match(action)) {
      user = action.payload;
    } else if (loadCurrentUser.fulfilled.match(action)) {
      user = action.payload;
    } else if (googleLogin.fulfilled.match(action)) {
      if (!action.payload.needsName) user = action.payload.user;
    } else if (setUser.match(action)) {
      user = action.payload;
    }

    if (user) {
      // Sync lock state
      listenerApi.dispatch(syncFromUser(user));
      // Seed notification prefs from the user payload (avoids an extra network call)
      listenerApi.dispatch(seedPrefsFromUser(user));
      // Also fetch latest prefs from server to ensure freshness (e.g. updated on another device)
      listenerApi.dispatch(loadPrefs() as Parameters<typeof listenerApi.dispatch>[0]);
    }
  },
});

// On logout: reset lock + notification prefs to default
listenerMiddleware.startListening({
  actionCreator: logout.fulfilled,
  effect: (_action, listenerApi) => {
    // Reset lock slice to default (unlocked) — the user is gone
    listenerApi.dispatch(syncFromUser({
      id: '',
      name: '',
      email: '',
      avatar: null,
      emailVerified: false,
      activeMembershipId: null,
      isAppLocked: false,
      hasLockPin: false,
      lockTimeoutMin: 5,
    }));
    // Reset notification prefs
    listenerApi.dispatch(resetPrefs());
  },
});

export const store = configureStore({
  reducer: {
    auth: authReducer,
    home: homeReducer,
    lock: lockReducer,
    notifications: notificationReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().prepend(listenerMiddleware.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
