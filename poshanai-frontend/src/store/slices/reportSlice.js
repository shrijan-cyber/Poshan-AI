import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import apiClient from '../../api/client.js';

const getErrorMessage = (error) => error.response?.data?.error?.message || error.message || 'Unable to load reports.';

const unwrapResponse = (response) => {
  if (!response.data?.success) {
    throw new Error(response.data?.error?.message || 'The report request failed.');
  }
  return response.data.data;
};

export const fetchReports = createAsyncThunk('reports/fetchAll', async (params = {}, { rejectWithValue, signal }) => {
  try {
    return unwrapResponse(await apiClient.get('/reports', { params, signal }));
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const fetchReportById = createAsyncThunk('reports/fetchById', async (reportId, { rejectWithValue, signal }) => {
  try {
    const result = unwrapResponse(await apiClient.get(`/reports/${encodeURIComponent(reportId)}`, { signal }));
    return result.report;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const uploadReport = createAsyncThunk('reports/upload', async (file, { rejectWithValue, signal }) => {
  try {
    if (typeof File === 'undefined' || !(file instanceof File)) throw new TypeError('Select a report file to upload.');
    const formData = new FormData();
    formData.append('file', file);
    const result = unwrapResponse(await apiClient.post('/reports/upload', formData, {
      signal,
      headers: { 'Content-Type': 'multipart/form-data' },
    }));
    return result.report;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const deleteReport = createAsyncThunk('reports/delete', async (reportId, { rejectWithValue, signal }) => {
  try {
    await apiClient.delete(`/reports/${encodeURIComponent(reportId)}`, { signal });
    return reportId;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

const reportSlice = createSlice({
  name: 'reports',
  initialState: { items: [], selectedReport: null, pagination: null, loading: false, error: null },
  reducers: {
    clearReportError(state) {
      state.error = null;
    },
    clearSelectedReport(state) {
      state.selectedReport = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchReports.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchReports.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.reports;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchReports.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
      })
      .addCase(fetchReportById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchReportById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedReport = action.payload;
        const index = state.items.findIndex((report) => report._id === action.payload._id);
        if (index >= 0) state.items[index] = action.payload;
      })
      .addCase(fetchReportById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
      })
      .addCase(uploadReport.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(uploadReport.fulfilled, (state, action) => {
        state.loading = false;
        state.items.unshift(action.payload);
        state.selectedReport = action.payload;
      })
      .addCase(uploadReport.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
      })
      .addCase(deleteReport.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteReport.fulfilled, (state, action) => {
        state.loading = false;
        state.items = state.items.filter((report) => report._id !== action.payload);
        if (state.selectedReport?._id === action.payload) state.selectedReport = null;
      })
      .addCase(deleteReport.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
      });
  },
});

export const { clearReportError, clearSelectedReport } = reportSlice.actions;
export default reportSlice.reducer;
