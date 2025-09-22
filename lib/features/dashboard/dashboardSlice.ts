import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

interface DashboardState {
  totalTransformations: number
  successRate: number
  activeConnections: number
  recentActivity: Array<{
    id: string
    type: "transform" | "upload" | "download"
    status: "success" | "error" | "pending"
    timestamp: string
    details: string
  }>
  systemHealth: {
    api: "healthy" | "degraded" | "down"
    database: "healthy" | "degraded" | "down"
    storage: "healthy" | "degraded" | "down"
  }
}

const initialState: DashboardState = {
  totalTransformations: 0,
  successRate: 0,
  activeConnections: 0,
  recentActivity: [],
  systemHealth: {
    api: "healthy",
    database: "healthy",
    storage: "healthy",
  },
}

const dashboardSlice = createSlice({
  name: "dashboard",
  initialState,
  reducers: {
    updateMetrics: (state, action: PayloadAction<Partial<DashboardState>>) => {
      Object.assign(state, action.payload)
    },
    addActivity: (state, action: PayloadAction<DashboardState["recentActivity"][0]>) => {
      state.recentActivity.unshift(action.payload)
      if (state.recentActivity.length > 10) {
        state.recentActivity.pop()
      }
    },
    updateSystemHealth: (state, action: PayloadAction<DashboardState["systemHealth"]>) => {
      state.systemHealth = action.payload
    },
  },
})

export const { updateMetrics, addActivity, updateSystemHealth } = dashboardSlice.actions
export default dashboardSlice.reducer
