import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import apiClient from '../../api/client.js';

const getErrorMessage = (error) => error.response?.data?.error?.message || error.message || 'Unable to load meal plans.';

const unwrapResponse = (response) => {
  if (!response.data?.success) {
    throw new Error(response.data?.error?.message || 'The meal plan request failed.');
  }
  return response.data.data;
};

export const fetchMealPlans = createAsyncThunk('mealPlans/fetchAll', async (params = {}, { rejectWithValue, signal }) => {
  try {
    return unwrapResponse(await apiClient.get('/mealplans', { params, signal }));
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const fetchMealPlanById = createAsyncThunk('mealPlans/fetchById', async (planId, { rejectWithValue, signal }) => {
  try {
    const result = unwrapResponse(await apiClient.get(`/mealplans/${encodeURIComponent(planId)}`, { signal }));
    return result.mealPlan;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const generateMealPlan = createAsyncThunk('mealPlans/generate', async (planRequest, { rejectWithValue, signal }) => {
  try {
    const result = unwrapResponse(await apiClient.post('/mealplans/generate', planRequest, { signal }));
    return result.mealPlan;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const updateMealPlanStatus = createAsyncThunk('mealPlans/updateStatus', async ({ planId, status }, { rejectWithValue, signal }) => {
  try {
    const result = unwrapResponse(await apiClient.patch(`/mealplans/${encodeURIComponent(planId)}/status`, { status }, { signal }));
    return result.mealPlan;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

const mealPlanSlice = createSlice({
  name: 'mealPlans',
  initialState: { items: [], selectedMealPlan: null, pagination: null, loading: false, error: null },
  reducers: {
    clearMealPlanError(state) {
      state.error = null;
    },
    clearSelectedMealPlan(state) {
      state.selectedMealPlan = null;
    },
  },
  extraReducers: (builder) => {
    const setLoading = (state) => {
      state.loading = true;
      state.error = null;
    };
    const setError = (state, action) => {
      state.loading = false;
      state.error = action.payload || action.error.message;
    };
    const savePlan = (state, action) => {
      state.loading = false;
      state.selectedMealPlan = action.payload;
      const index = state.items.findIndex((plan) => plan._id === action.payload._id);
      if (index >= 0) state.items[index] = action.payload;
      else state.items.unshift(action.payload);
    };

    builder
      .addCase(fetchMealPlans.pending, setLoading)
      .addCase(fetchMealPlans.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.mealPlans;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchMealPlans.rejected, setError)
      .addCase(fetchMealPlanById.pending, setLoading)
      .addCase(fetchMealPlanById.fulfilled, savePlan)
      .addCase(fetchMealPlanById.rejected, setError)
      .addCase(generateMealPlan.pending, setLoading)
      .addCase(generateMealPlan.fulfilled, savePlan)
      .addCase(generateMealPlan.rejected, setError)
      .addCase(updateMealPlanStatus.pending, setLoading)
      .addCase(updateMealPlanStatus.fulfilled, savePlan)
      .addCase(updateMealPlanStatus.rejected, setError);
  },
});

export const { clearMealPlanError, clearSelectedMealPlan } = mealPlanSlice.actions;
export default mealPlanSlice.reducer;
