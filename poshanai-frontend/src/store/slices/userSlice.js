import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import apiClient from '../../api/client.js';

const getErrorMessage = (error) => error.response?.data?.error?.message || error.message || 'Unable to load your profile.';

const unwrapResponse = (response) => {
  if (!response.data?.success) {
    throw new Error(response.data?.error?.message || 'The profile request failed.');
  }
  return response.data.data;
};

export const fetchProfile = createAsyncThunk('user/fetchProfile', async (_, { rejectWithValue, signal }) => {
  try {
    const result = unwrapResponse(await apiClient.get('/users/me', { signal }));
    return result.user;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const updateProfile = createAsyncThunk('user/updateProfile', async (profile, { rejectWithValue, signal }) => {
  try {
    const result = unwrapResponse(await apiClient.put('/users/me', profile, { signal }));
    return result.user;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const fetchCurrentUser = fetchProfile;
export const updateUserProfile = updateProfile;

const userSlice = createSlice({
  name: 'user',
  initialState: { profile: null, loading: false, error: null },
  reducers: {
    clearUserError(state) {
      state.error = null;
    },
    clearUserProfile(state) {
      state.profile = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.profile = action.payload;
      })
      .addCase(fetchProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
      })
      .addCase(updateProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.profile = action.payload;
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
      });
  },
});

export const { clearUserError, clearUserProfile } = userSlice.actions;
export default userSlice.reducer;
