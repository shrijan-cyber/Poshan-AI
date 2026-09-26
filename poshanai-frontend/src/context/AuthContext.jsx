import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import * as authApi from '../api/authApi.js';
import { setAuthTokenHandlers } from '../api/client.js';

const AuthContext = createContext(null);

const initialState = { user: null, accessToken: null, isLoading: true };

function authReducer(state, action) {
  switch (action.type) {
    case 'AUTHENTICATED':
      return { user: action.user, accessToken: action.accessToken, isLoading: false };
    case 'TOKEN_UPDATED':
      return { ...state, accessToken: action.accessToken };
    case 'SIGNED_OUT':
      return { user: null, accessToken: null, isLoading: false };
    case 'FINISHED_LOADING':
      return { ...state, isLoading: false };
    default:
      return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const tokenRef = useRef(null);
  tokenRef.current = state.accessToken;

  const setToken = useCallback((accessToken) => {
    tokenRef.current = accessToken;
    dispatch({ type: 'TOKEN_UPDATED', accessToken });
  }, []);

  const clearSession = useCallback(() => {
    tokenRef.current = null;
    dispatch({ type: 'SIGNED_OUT' });
  }, []);

  const establishSession = useCallback((payload) => {
    if (!payload?.accessToken || !payload?.user) throw new Error('The server returned an invalid authentication response.');
    tokenRef.current = payload.accessToken;
    dispatch({ type: 'AUTHENTICATED', accessToken: payload.accessToken, user: payload.user });
    return payload.user;
  }, []);

  const refreshToken = useCallback(async () => {
    const result = await authApi.refresh();
    if (!result?.accessToken) throw new Error('The server did not return a renewed access token.');
    setToken(result.accessToken);
    if (!state.user) {
      const currentUser = await authApi.getCurrentUser();
      dispatch({ type: 'AUTHENTICATED', user: currentUser.user, accessToken: result.accessToken });
    }
    return result.accessToken;
  }, [setToken, state.user]);

  const login = useCallback(async (email, password) => {
    try {
      const user = establishSession(await authApi.login(email, password));
      return { success: true, data: { user } };
    } catch (error) {
      return { success: false, error: { code: error.code || 'LOGIN_FAILED', message: error.message || 'Unable to log in.' } };
    }
  }, [establishSession]);

  const register = useCallback(async (registrationData) => {
    try {
      const user = establishSession(await authApi.register(registrationData));
      return { success: true, data: { user } };
    } catch (error) {
      return { success: false, error: { code: error.code || 'REGISTER_FAILED', message: error.message || 'Unable to register.' } };
    }
  }, [establishSession]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  useEffect(() => {
    setAuthTokenHandlers({
      getToken: () => tokenRef.current,
      setToken,
      onUnauthorized: clearSession,
    });
    return () => setAuthTokenHandlers();
  }, [clearSession, setToken]);

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      try {
        const result = await authApi.refresh();
        if (!result?.accessToken) throw new Error('No access token returned.');
        tokenRef.current = result.accessToken;
        const currentUser = await authApi.getCurrentUser();
        if (active) dispatch({ type: 'AUTHENTICATED', user: currentUser.user, accessToken: result.accessToken });
      } catch {
        if (active) dispatch({ type: 'SIGNED_OUT' });
      }
    };
    restoreSession();
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(() => ({
    ...state,
    login,
    register,
    logout,
    refreshToken,
  }), [login, logout, refreshToken, register, state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider.');
  return context;
}
