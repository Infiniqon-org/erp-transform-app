import { configureStore } from "@reduxjs/toolkit"
import { type TypedUseSelectorHook, useDispatch, useSelector } from "react-redux"
import dashboardSlice from "./features/dashboard/dashboardSlice"
import apiSlice from "./features/api/apiSlice"
import transformSlice from "./features/transform/transformSlice"

export const store = configureStore({
  reducer: {
    dashboard: dashboardSlice,
    api: apiSlice,
    transform: transformSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ["persist/PERSIST"],
      },
    }),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export const useAppDispatch = () => useDispatch<AppDispatch>()
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
