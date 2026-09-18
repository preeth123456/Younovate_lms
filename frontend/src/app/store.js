// src/app/store.js
import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { combineReducers } from 'redux';

import authReducer          from '../features/auth/authSlice';
import notificationsReducer  from '../features/notifications/notificationsSlice';
import adminReducer         from '../features/admin/adminSlice';
import adminSessionsReducer from '../features/admin/adminSessionsSlice';   // admin-side (new)
import hrReducer            from '../features/hr/hrSlice';
import traineeReducer       from '../features/trainee/traineeSlice';
import trainerReducer       from '../features/Trainer/trainerSlice';
import trainerWorkshopReducer from '../features/Trainer/trainerWorkshopSlice';
import assignmentsReducer   from '../features/assignment/assignmentsSlice';
import batchReducer         from '../features/session/batchSlice';
import courseReducer        from '../features/admin/courseSlice';
import workshopReducer         from '../features/workshops/workshopSlice';
import workshopSessionsReducer from '../features/workshops/workshopSessionsSlice';

// Three DIFFERENT session slices, three DIFFERENT files, three DIFFERENT keys:
import sessionsReducer        from '../features/session/sessionsSlice';   // trainer-side (existing)
import traineeSessionsReducer from '../features/sessions/sessionsSlice';  // trainee-side (new)

// Persist only auth so the user stays logged in on page refresh
const authPersistConfig = {
  key: 'auth',
  storage,
  whitelist: ['token', 'user', 'isAuthenticated'],
};

const rootReducer = combineReducers({
  auth:            persistReducer(authPersistConfig, authReducer),
  notifications:   notificationsReducer,
  admin:           adminReducer,
  hr:              hrReducer,
  trainee:         traineeReducer,
  trainer:         trainerReducer,
  trainerWorkshop: trainerWorkshopReducer,
  sessions:        sessionsReducer,         // ← trainer slice  -> selectors read s.sessions.*
  traineeSessions: traineeSessionsReducer,  // ← trainee slice  -> selectors read s.traineeSessions.*
  adminSessions:   adminSessionsReducer,    // ← admin slice    -> selectors read s.adminSessions.*
  assignments:     assignmentsReducer,
  batches:         batchReducer,
  courses:         courseReducer,
  workshops:          workshopReducer,
  workshopSessions:   workshopSessionsReducer,
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE', 'persist/PURGE'],
      },
    }),
});

export const persistor = persistStore(store);

export default store;