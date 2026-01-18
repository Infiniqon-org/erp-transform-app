"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  FileStatusResponse,
  OverallDqReportResponse,
  fileManagementAPI,
} from "@/lib/api/file-management-api";
import { useAuth } from "@/components/providers/auth-provider";
import {
  Loader2,
  TrendingUp,
  FileText,
  CheckCircle,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DqChartsProps {
  files: FileStatusResponse[];
}

// Color palette - softer colors for charts (easy on the eyes)
const CHART_COLORS = {
  // Solid colors for strokes/borders
  green: "#22C55E",
  yellow: "#EAB308",
  red: "#EF4444",
  blue: "#3B82F6",
  purple: "#8B5CF6",
  pink: "#EC4899",
  teal: "#14B8A6",
  orange: "#F97316",
  // Softer fill colors with transparency - brighter for pie/bar charts
  greenSoft: "rgba(34, 197, 94, 0.75)", // green-500/75
  yellowSoft: "rgba(234, 179, 8, 0.75)", // yellow-500/75
  redSoft: "rgba(239, 68, 68, 0.7)", // red-500/70
  blueSoft: "rgba(59, 130, 246, 0.65)", // blue-500/65
  purpleSoft: "rgba(139, 92, 246, 0.4)", // purple-500/40
  tealSoft: "rgba(20, 184, 166, 0.4)", // teal-500/40
};

const chartConfig = {
  rowsIn: {
    label: "Rows In",
    color: CHART_COLORS.purple,
  },
  rowsOut: {
    label: "Rows Out",
    color: CHART_COLORS.teal,
  },
  rowsFixed: {
    label: "Rows Fixed",
    color: CHART_COLORS.yellow,
  },
  rowsQuarantined: {
    label: "Quarantined",
    color: CHART_COLORS.red,
  },
  filesProcessed: {
    label: "Files Processed",
    color: CHART_COLORS.blue,
  },
  filesDeleted: {
    label: "Files Deleted",
    color: CHART_COLORS.red,
  },
  clean: {
    label: "Validated",
    color: CHART_COLORS.green,
  },
  fixed: {
    label: "Fixed",
    color: CHART_COLORS.yellow,
  },
  quarantined: {
    label: "Quarantined",
    color: CHART_COLORS.red,
  },
};

export function DqCharts({ files }: DqChartsProps) {
  const { idToken } = useAuth();
  const [overallReport, setOverallReport] =
    useState<OverallDqReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<'day' | 'week' | 'month' | 'year'>('month');

  useEffect(() => {
    const loadOverallReport = async () => {
      if (!idToken) return;
      try {
        const report = await fileManagementAPI.downloadOverallDqReport(idToken);
        setOverallReport(report);
      } catch (error) {
        console.error("Error loading overall DQ report:", error);
        // Use file data as fallback
      } finally {
        setLoading(false);
      }
    };
    loadOverallReport();
  }, [idToken]);

  // Calculate data from files
  const completedFiles = files.filter((f) => f.status === "DQ_FIXED");
  const processingFiles = files.filter((f) =>
    ["DQ_RUNNING", "NORMALIZING", "QUEUED", "UPLOADING"].includes(f.status)
  );
  const failedFiles = files.filter((f) =>
    ["DQ_FAILED", "UPLOAD_FAILED"].includes(f.status)
  );

  const totalRowsIn = completedFiles.reduce(
    (sum, f) => sum + (f.rows_in || 0),
    0
  );
  const totalRowsFixed = completedFiles.reduce(
    (sum, f) => sum + (f.rows_fixed || 0),
    0
  );
  const totalRowsQuarantined = completedFiles.reduce(
    (sum, f) => sum + (f.rows_quarantined || 0),
    0
  );
  const totalRowsOut = totalRowsIn - totalRowsQuarantined;
  const avgDqScore =
    completedFiles.length > 0
      ? completedFiles.reduce((sum, f) => sum + (f.dq_score || 0), 0) /
        completedFiles.length
      : 0;

  // Prepare data from files based on time period
  const generateTimeBasedData = () => {
    const processedFiles = completedFiles.filter(f => f.uploaded_at || f.created_at);
    
    if (processedFiles.length === 0) return [];

    if (timePeriod === 'day') {
      // Group by hour for today - 24 hours (12 AM to 12 AM next day)
      const hourGroups: Record<string, { rowsIn: number; cleanRows: number; rowsQuarantined: number; hour: number }> = {};
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Initialize 24 hours with 3-hour intervals (8 time slots)
      for (let i = 0; i < 24; i += 3) {
        const hour = i;
        const displayHour = hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`;
        hourGroups[displayHour] = { rowsIn: 0, cleanRows: 0, rowsQuarantined: 0, hour };
      }
      
      // Aggregate data by hour for today only
      processedFiles.forEach(f => {
        const fileDate = new Date(f.uploaded_at || f.created_at!);
        // Check if file is from today
        if (fileDate.toDateString() === today.toDateString()) {
          const hour = fileDate.getHours();
          // Find the appropriate 3-hour bucket
          const bucketHour = Math.floor(hour / 3) * 3;
          const displayHour = bucketHour === 0 ? '12 AM' : bucketHour < 12 ? `${bucketHour} AM` : bucketHour === 12 ? '12 PM' : `${bucketHour - 12} PM`;
          
          if (hourGroups[displayHour]) {
            hourGroups[displayHour].rowsIn += f.rows_in || 0;
            hourGroups[displayHour].cleanRows += (f.rows_in || 0) - (f.rows_quarantined || 0);
            hourGroups[displayHour].rowsQuarantined += f.rows_quarantined || 0;
          }
        }
      });
      
      // Sort by hour and return
      return Object.entries(hourGroups)
        .sort(([, a], [, b]) => a.hour - b.hour)
        .map(([period, data]) => ({
          period,
          filesProcessed: 0,
          filesDeleted: 0,
          rowsIn: data.rowsIn,
          cleanRows: data.cleanRows,
          rowsQuarantined: data.rowsQuarantined,
        }));
      
    } else if (timePeriod === 'week') {
      // Group by weekday - last 7 days showing day names
      const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayGroups: Record<string, { rowsIn: number; cleanRows: number; rowsQuarantined: number; dayNum: number }> = {};
      const now = new Date();
      
      // Initialize last 7 days with day names
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dayNum = date.getDay();
        const key = weekDays[dayNum];
        if (!dayGroups[key]) {
          dayGroups[key] = { rowsIn: 0, cleanRows: 0, rowsQuarantined: 0, dayNum };
        }
      }
      
      // Aggregate data by weekday
      processedFiles.forEach(f => {
        const fileDate = new Date(f.uploaded_at || f.created_at!);
        const dayOfWeek = new Date().getTime() - fileDate.getTime();
        if (dayOfWeek <= 7 * 24 * 60 * 60 * 1000) { // Last 7 days
          const dayNum = fileDate.getDay();
          const key = weekDays[dayNum];
          if (dayGroups[key]) {
            dayGroups[key].rowsIn += f.rows_in || 0;
            dayGroups[key].cleanRows += (f.rows_in || 0) - (f.rows_quarantined || 0);
            dayGroups[key].rowsQuarantined += f.rows_quarantined || 0;
          }
        }
      });
      
      // Sort by day of week (Sun-Sat)
      return Object.entries(dayGroups)
        .sort(([, a], [, b]) => a.dayNum - b.dayNum)
        .map(([period, data]) => ({
          period,
          filesProcessed: 0,
          filesDeleted: 0,
          rowsIn: data.rowsIn,
          cleanRows: data.cleanRows,
          rowsQuarantined: data.rowsQuarantined,
        }));
      
    } else if (timePeriod === 'month') {
      // Month view - last 6 months
      if (overallReport?.months) {
        return Object.entries(overallReport.months)
          .map(([month, stats]) => ({
            period: month,
            filesProcessed: stats.files_processed,
            filesDeleted: stats.files_deleted,
            rowsIn: stats.rows_in,
            cleanRows: stats.rows_in - stats.rows_quarantined,
            rowsQuarantined: stats.rows_quarantined,
            processingTime: stats.total_processing_time_seconds,
          }))
          .sort((a, b) => {
            const [aMonth, aYear] = a.period.split("/");
            const [bMonth, bYear] = b.period.split("/");
            return (
              new Date(`${aYear}-${aMonth}-01`).getTime() -
              new Date(`${bYear}-${bMonth}-01`).getTime()
            );
          })
          .slice(-6);
      } else {
        // Fallback: aggregate by month from files - last 6 months
        const monthGroups: Record<string, { rowsIn: number; cleanRows: number; rowsQuarantined: number }> = {};
        
        processedFiles.forEach(f => {
          const fileDate = new Date(f.uploaded_at || f.created_at!);
          const key = fileDate.toLocaleDateString('en-US', { month: 'short' });
          if (!monthGroups[key]) {
            monthGroups[key] = { rowsIn: 0, cleanRows: 0, rowsQuarantined: 0 };
          }
          monthGroups[key].rowsIn += f.rows_in || 0;
          monthGroups[key].cleanRows += (f.rows_in || 0) - (f.rows_quarantined || 0);
          monthGroups[key].rowsQuarantined += f.rows_quarantined || 0;
        });
        
        return Object.entries(monthGroups).map(([period, data]) => ({
          period,
          filesProcessed: 0,
          filesDeleted: 0,
          ...data,
        }));
      }
    } else {
      // Year view - all 12 months of current year
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const currentYear = new Date().getFullYear();
      const monthGroups: Record<string, { rowsIn: number; cleanRows: number; rowsQuarantined: number }> = {};
      
      // Initialize all 12 months
      monthNames.forEach(month => {
        monthGroups[month] = { rowsIn: 0, cleanRows: 0, rowsQuarantined: 0 };
      });
      
      // Aggregate data for current year
      processedFiles.forEach(f => {
        const fileDate = new Date(f.uploaded_at || f.created_at!);
        if (fileDate.getFullYear() === currentYear) {
          const monthIndex = fileDate.getMonth();
          const key = monthNames[monthIndex];
          monthGroups[key].rowsIn += f.rows_in || 0;
          monthGroups[key].cleanRows += (f.rows_in || 0) - (f.rows_quarantined || 0);
          monthGroups[key].rowsQuarantined += f.rows_quarantined || 0;
        }
      });
      
      return monthNames.map(month => ({
        period: month,
        filesProcessed: 0,
        filesDeleted: 0,
        ...monthGroups[month],
      }));
    }
  };

  const monthlyData = generateTimeBasedData();

  // Data quality distribution pie chart data
  const dqDistributionData = [
    {
      name: "Validated",
      value: totalRowsOut - totalRowsFixed,
      fill: CHART_COLORS.greenSoft,
    },
    { name: "Fixed", value: totalRowsFixed, fill: CHART_COLORS.yellowSoft },
    {
      name: "Quarantined",
      value: totalRowsQuarantined,
      fill: CHART_COLORS.redSoft,
    },
  ].filter((d) => d.value > 0);

  // File status distribution
  const fileStatusData = [
    {
      name: "Completed",
      value: completedFiles.length,
      fill: CHART_COLORS.greenSoft,
    },
    {
      name: "Processing",
      value: processingFiles.length,
      fill: CHART_COLORS.blueSoft,
    },
    { name: "Failed", value: failedFiles.length, fill: CHART_COLORS.redSoft },
  ].filter((d) => d.value > 0);

  // Per-file DQ scores for bar chart
  const fileScoresData = completedFiles.slice(0, 10).map((f) => ({
    name:
      (f.original_filename || f.filename || "File").slice(0, 15) +
      ((f.original_filename || f.filename || "").length > 15 ? "..." : ""),
    score: f.dq_score || 0,
    fill:
      (f.dq_score || 0) >= 90
        ? CHART_COLORS.greenSoft
        : (f.dq_score || 0) >= 70
        ? CHART_COLORS.yellowSoft
        : CHART_COLORS.redSoft,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Total Files</span>
            </div>
            <div className="text-2xl font-bold">{files.length}</div>
            <p className="text-xs text-muted-foreground">
              {completedFiles.length} files processed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">
                Avg DQ
              </span>
            </div>
            <div className={`text-2xl font-bold ${avgDqScore >= 90 ? "text-green-500" : avgDqScore >= 70 ? "text-yellow-500" : "text-red-500"}`}>{avgDqScore.toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">
                Rows Processed
              </span>
            </div>
            <div className="text-2xl font-bold">
              {totalRowsIn.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalRowsOut.toLocaleString()} valid output rows
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">
                Issues Resolved
              </span>
            </div>
            <div className="text-2xl font-bold">
              {totalRowsFixed.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalRowsQuarantined.toLocaleString()} quarantined
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row: DQ Score Distribution (1/2) + Data Quality Distribution (1/2) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Data Quality Distribution */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-sm font-semibold">
              Data Quality Distribution
            </CardTitle>
            <CardDescription className="text-xs">
              Breakdown of processed rows by quality status
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-1">
            {dqDistributionData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[220px] w-full">
                <PieChart>
                  <Pie
                    data={dqDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${((percent as number) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                    strokeWidth={0}
                  >
                    {dqDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-xs">
                No records available
              </div>
            )}
          </CardContent>
        </Card>

        {/* DQ Score Distribution */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-sm font-semibold">
              Data Quality Score Distribution
            </CardTitle>
            <CardDescription className="text-xs">
              Files grouped by quality score ranges
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-1">
            {completedFiles.length > 0 ? (
              (() => {
                const excellent = completedFiles.filter(
                  (f) => (f.dq_score || 0) >= 90
                ).length;
                const good = completedFiles.filter(
                  (f) => (f.dq_score || 0) >= 70 && (f.dq_score || 0) < 90
                ).length;
                const bad = completedFiles.filter(
                  (f) => (f.dq_score || 0) < 70
                ).length;

                const scoreDistData = [
                  {
                    name: "Excellent (90-100%)",
                    value: excellent,
                    fill: CHART_COLORS.greenSoft,
                  },
                  {
                    name: "Good (70-89%)",
                    value: good,
                    fill: CHART_COLORS.yellowSoft,
                  },
                  {
                    name: "Bad (<70%)",
                    value: bad,
                    fill: CHART_COLORS.redSoft,
                  },
                ].filter((d) => d.value > 0);

                return (
                  <div className="flex flex-col gap-3">
                    <ChartContainer
                      config={chartConfig}
                      className="h-[180px] w-full"
                    >
                      <BarChart
                        data={scoreDistData}
                        layout="vertical"
                        margin={{ left: 0, right: 10 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          horizontal={true}
                          vertical={false}
                          stroke="#E5E7EB"
                        />
                        <XAxis type="number" stroke="#9CA3AF" fontSize={10} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={110}
                          tick={{ fontSize: 10 }}
                          stroke="#9CA3AF"
                        />
                        <ChartTooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-background border rounded-lg shadow-md p-2 text-xs">
                                  <p className="font-medium">
                                    {payload[0].payload.name}
                                  </p>
                                  <p className="text-muted-foreground">
                                    {payload[0].value} files
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {scoreDistData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                    <div className="flex gap-2 justify-center">
                      <div className="p-2 rounded-lg bg-green-500/10 text-center flex-1">
                        <p className="text-lg font-bold text-green-600 dark:text-green-400">
                          {excellent}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Excellent
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-yellow-500/10 text-center flex-1">
                        <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                          {good}
                        </p>
                        <p className="text-xs text-muted-foreground">Good</p>
                      </div>
                      <div className="p-2 rounded-lg bg-red-500/10 text-center flex-1">
                        <p className="text-lg font-bold text-red-600 dark:text-red-400">
                          {bad}
                        </p>
                        <p className="text-xs text-muted-foreground">Bad</p>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-xs">
                No processed files available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trends - Full width with comprehensive data */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-1 pt-3 px-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                Processing Trends
              </CardTitle>
              <CardDescription className="text-xs">
                Row-level processing statistics over time
              </CardDescription>
            </div>
            <Tabs value={timePeriod} onValueChange={(value) => setTimePeriod(value as 'day' | 'week' | 'month' | 'year')}>
              <TabsList className="h-8">
                <TabsTrigger value="day" className="text-xs px-3 h-7">Day</TabsTrigger>
                <TabsTrigger value="week" className="text-xs px-3 h-7">Week</TabsTrigger>
                {/* <TabsTrigger value="month" className="text-xs px-3 h-7">Month</TabsTrigger> */}
                <TabsTrigger value="year" className="text-xs px-3 h-7">Year</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-1">
          {monthlyData.length > 0 ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={monthlyData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#E5E7EB"
                  />
                  <XAxis
                    dataKey="period"
                    tick={{ fontSize: 11 }}
                    stroke="#9CA3AF"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    stroke="#9CA3AF"
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) =>
                      value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value
                    }
                  />
                  <ChartTooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-background border rounded-lg shadow-md p-3 text-xs">
                            <p className="font-medium mb-2">{label}</p>
                            {payload.map((entry, index) => (
                              <div
                                key={index}
                                className="flex justify-between gap-4"
                              >
                                <span style={{ color: entry.color }}>
                                  {entry.name}:
                                </span>
                                <span className="font-medium">
                                  {Number(entry.value).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <Area
                    type="monotone"
                    dataKey="rowsIn"
                    name="Rows In"
                    stroke={CHART_COLORS.purple}
                    fill={CHART_COLORS.purpleSoft}
                    fillOpacity={0.5}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="cleanRows"
                    name="Validated Rows"
                    stroke={CHART_COLORS.green}
                    fill={CHART_COLORS.greenSoft}
                    fillOpacity={0.5}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="rowsQuarantined"
                    name="Quarantined"
                    stroke={CHART_COLORS.red}
                    fill={CHART_COLORS.redSoft}
                    fillOpacity={0.5}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground text-xs">
              No monthly data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Compact Trends for sidebar
export function MonthlyTrendsCompact({ files }: DqChartsProps) {
  const { idToken } = useAuth();
  const [overallReport, setOverallReport] =
    useState<OverallDqReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<'day' | 'week' | 'month' | 'year'>('month');

  useEffect(() => {
    const loadOverallReport = async () => {
      if (!idToken) return;
      try {
        const report = await fileManagementAPI.downloadOverallDqReport(idToken);
        setOverallReport(report);
      } catch (error) {
        console.error("Error loading overall DQ report:", error);
      } finally {
        setLoading(false);
      }
    };
    loadOverallReport();
  }, [idToken]);

  const generateCompactData = () => {
    const completedFiles = files.filter((f) => f.status === "DQ_FIXED" && (f.uploaded_at || f.created_at));
    
    if (timePeriod === 'day') {
      // Hourly view for today - 3-hour intervals
      const hourGroups: Record<string, { rows: number; fixed: number; hour: number }> = {};
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Initialize 3-hour intervals
      for (let i = 0; i < 24; i += 3) {
        const hour = i;
        const displayHour = hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`;
        hourGroups[displayHour] = { rows: 0, fixed: 0, hour };
      }
      
      completedFiles.forEach(f => {
        const fileDate = new Date(f.uploaded_at || f.created_at!);
        // Only include today's data
        if (fileDate.toDateString() === today.toDateString()) {
          const hour = fileDate.getHours();
          const bucketHour = Math.floor(hour / 3) * 3;
          const displayHour = bucketHour === 0 ? '12 AM' : bucketHour < 12 ? `${bucketHour} AM` : bucketHour === 12 ? '12 PM' : `${bucketHour - 12} PM`;
          
          if (hourGroups[displayHour]) {
            hourGroups[displayHour].rows += f.rows_in || 0;
            hourGroups[displayHour].fixed += f.rows_fixed || 0;
          }
        }
      });
      
      return Object.entries(hourGroups)
        .sort(([, a], [, b]) => a.hour - b.hour)
        .map(([period, data]) => ({
          month: period,
          rows: data.rows,
          fixed: data.fixed,
        }));
        
    } else if (timePeriod === 'week') {
      // Last 7 days by weekday
      const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayGroups: Record<string, { rows: number; fixed: number; dayNum: number }> = {};
      
      weekDays.forEach((day, idx) => {
        dayGroups[day] = { rows: 0, fixed: 0, dayNum: idx };
      });
      
      completedFiles.forEach(f => {
        const fileDate = new Date(f.uploaded_at || f.created_at!);
        const dayOfWeek = new Date().getTime() - fileDate.getTime();
        if (dayOfWeek <= 7 * 24 * 60 * 60 * 1000) {
          const dayNum = fileDate.getDay();
          const key = weekDays[dayNum];
          dayGroups[key].rows += f.rows_in || 0;
          dayGroups[key].fixed += f.rows_fixed || 0;
        }
      });
      
      return Object.entries(dayGroups)
        .sort(([, a], [, b]) => a.dayNum - b.dayNum)
        .map(([period, data]) => ({
          month: period,
          rows: data.rows,
          fixed: data.fixed,
        }));
        
    } else if (timePeriod === 'month') {
      // Month view - last 6 months
      if (overallReport?.months) {
        return Object.entries(overallReport.months)
          .map(([month, stats]) => ({
            month: month.split("/")[0],
            rows: stats.rows_in,
            fixed: stats.rows_fixed,
          }))
          .sort((a, b) => {
            const months = [
              "01", "02", "03", "04", "05", "06",
              "07", "08", "09", "10", "11", "12",
            ];
            return months.indexOf(a.month) - months.indexOf(b.month);
          })
          .slice(-6);
      } else {
        // Fallback: aggregate by month from files
        const monthGroups: Record<string, { rows: number; fixed: number }> = {};
        
        completedFiles.forEach(f => {
          const fileDate = new Date(f.uploaded_at || f.created_at!);
          const key = fileDate.toLocaleDateString('en-US', { month: 'short' });
          if (!monthGroups[key]) {
            monthGroups[key] = { rows: 0, fixed: 0 };
          }
          monthGroups[key].rows += f.rows_in || 0;
          monthGroups[key].fixed += f.rows_fixed || 0;
        });
        
        return Object.entries(monthGroups).map(([month, data]) => ({
          month,
          ...data,
        }));
      }
    } else {
      // Year view - all 12 months of current year
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const currentYear = new Date().getFullYear();
      const monthGroups: Record<string, { rows: number; fixed: number }> = {};
      
      // Initialize all 12 months
      monthNames.forEach(month => {
        monthGroups[month] = { rows: 0, fixed: 0 };
      });
      
      // Aggregate data for current year
      completedFiles.forEach(f => {
        const fileDate = new Date(f.uploaded_at || f.created_at!);
        if (fileDate.getFullYear() === currentYear) {
          const monthIndex = fileDate.getMonth();
          const key = monthNames[monthIndex];
          monthGroups[key].rows += f.rows_in || 0;
          monthGroups[key].fixed += f.rows_fixed || 0;
        }
      });
      
      return monthNames.map(month => ({
        month,
        ...monthGroups[month],
      }));
    }
  };

  const monthlyData = generateCompactData();

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 flex items-center justify-center h-[140px]">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (monthlyData.length === 0) {
    return null;
  }

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  return (
    <Card>
      <CardHeader className="py-3 px-4 pb-1">
        <div className="flex items-center justify-between mb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
            Trends
          </CardTitle>
          <Tabs value={timePeriod} onValueChange={(value) => setTimePeriod(value as 'day' | 'week' | 'month' | 'year')}>
            <TabsList className="h-6">
              <TabsTrigger value="day" className="text-[10px] px-2 h-5">D</TabsTrigger>
              <TabsTrigger value="week" className="text-[10px] px-2 h-5">W</TabsTrigger>
              <TabsTrigger value="month" className="text-[10px] px-2 h-5">M</TabsTrigger>
              <TabsTrigger value="year" className="text-[10px] px-2 h-5">Y</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-2">
        <div className="h-[100px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={monthlyData}
              margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
            >
              <XAxis
                dataKey="month"
                tick={{ fontSize: 9 }}
                stroke="#9CA3AF"
                tickFormatter={(val) => {
                  // For day/week view, return as is (already formatted)
                  if (timePeriod === 'day' || timePeriod === 'week') {
                    return val;
                  }
                  // For month view, map numeric month to name
                  return monthNames[parseInt(val) - 1] || val;
                }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <ChartTooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const period = payload[0].payload.month;
                    let displayPeriod = period;
                    
                    // Format month names for numeric months
                    if (timePeriod === 'month' && /^\d{2}$/.test(period)) {
                      displayPeriod = monthNames[parseInt(period) - 1] || period;
                    }
                    
                    return (
                      <div className="bg-background border rounded-md shadow-sm p-2 text-xs">
                        <p className="font-medium">{displayPeriod}</p>
                        <p className="text-muted-foreground">
                          {payload[0].value?.toLocaleString()} rows
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="rows"
                stroke={CHART_COLORS.purple}
                fill={CHART_COLORS.purpleSoft}
                fillOpacity={0.5}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// Export Processing Summary as a separate component
export function ProcessingSummary({ files }: DqChartsProps) {
  const completedFiles = files.filter((f) => f.status === "DQ_FIXED");
  const totalRowsIn = completedFiles.reduce(
    (sum, f) => sum + (f.rows_in || 0),
    0
  );
  const totalRowsFixed = completedFiles.reduce(
    (sum, f) => sum + (f.rows_fixed || 0),
    0
  );
  const totalRowsQuarantined = completedFiles.reduce(
    (sum, f) => sum + (f.rows_quarantined || 0),
    0
  );
  const totalRowsOut = totalRowsIn - totalRowsQuarantined;

  return (
    <Card>
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-base font-semibold">
          Processing Summary
        </CardTitle>
        <CardDescription className="text-xs">
          Data quality metrics breakdown
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2 pb-3 max-h-[280px] overflow-y-auto">
        <div className="space-y-1.5">
          <div className="flex justify-between items-center p-2 rounded-lg bg-muted/50">
            <span className="text-sm text-muted-foreground">
              Total Input Rows
            </span>
            <span className="text-sm font-medium">
              {totalRowsIn.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center p-2 rounded-lg bg-green-500/10">
            <span className="text-sm text-muted-foreground">Valid Output Rows</span>
            <span className="text-sm font-medium text-green-600 dark:text-green-400">
              {totalRowsOut.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center p-2 rounded-lg bg-yellow-500/10">
            <span className="text-sm text-muted-foreground">Issues Resolved</span>
            <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
              {totalRowsFixed.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center p-2 rounded-lg bg-red-500/10">
            <span className="text-sm text-muted-foreground">Records Quarantined</span>
            <span className="text-sm font-medium text-red-600 dark:text-red-400">
              {totalRowsQuarantined.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center p-2 rounded-lg bg-muted/50">
            <span className="text-sm text-muted-foreground">Success Rate</span>
            <span className="text-sm font-medium">
              {files.length > 0
                ? `${Math.round((completedFiles.length / files.length) * 100)}%`
                : "0%"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
