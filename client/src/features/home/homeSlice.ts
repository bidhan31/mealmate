import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { homeApi } from '@/api/homeApi';
import type { HomeDto, MyMembership } from '@/types/home';

interface HomeState {
  home: HomeDto | null;
  membership: MyMembership | null;
  status: 'idle' | 'loading' | 'loaded';
}

const initialState: HomeState = {
  home: null,
  membership: null,
  status: 'idle',
};

export const loadMyHome = createAsyncThunk('home/loadMyHome', async () => {
  const { data } = await homeApi.myHome();
  return data.data;
});

const homeSlice = createSlice({
  name: 'home',
  initialState,
  reducers: {
    clearHome(state) {
      state.home = null;
      state.membership = null;
      state.status = 'idle';
    },
    setHome(state, action: PayloadAction<HomeDto>) {
      state.home = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadMyHome.pending, (s) => {
        s.status = 'loading';
      })
      .addCase(loadMyHome.fulfilled, (s, a) => {
        s.home = a.payload.home;
        s.membership = a.payload.membership;
        s.status = 'loaded';
      })
      .addCase(loadMyHome.rejected, (s) => {
        s.status = 'loaded';
      });
  },
});

export const { clearHome, setHome } = homeSlice.actions;
export default homeSlice.reducer;
