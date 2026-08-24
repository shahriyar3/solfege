'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Download, Trash2 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';

interface SessionData {
  id: string;
  name: string;
  createdAt: string;
  notes: {
    id: string;
    noteName: string;
    solfege: string;
    cents: number;
    isAccurate: boolean;
  }[];
}

interface NoteAccuracy {
  name: string;
  count: number;
  accurate: number;
  accuracy: number;
  avgCents: number;
}

export function PerformanceChart() {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [chartData, setChartData] = useState<NoteAccuracy[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch('/api/solfeggio/sessions')
      .then((r) => r.json())
      .then((data) => {
        setSessions(data);
        processChartData(data);
      });
  }, []);

  const processChartData = (data: SessionData[]) => {
    const noteMap = new Map<string, { count: number; accurate: number; totalCents: number }>();

    data.forEach((s) => {
      s.notes.forEach((n) => {
        const key = n.solfege || n.noteName;
        const existing = noteMap.get(key) || { count: 0, accurate: 0, totalCents: 0 };
        existing.count += 1;
        if (n.isAccurate) existing.accurate += 1;
        existing.totalCents += Math.abs(n.cents);
        noteMap.set(key, existing);
      });
    });

    const sorted = Array.from(noteMap.entries())
      .map(([name, data]) => ({
        name,
        count: data.count,
        accurate: data.accurate,
        accuracy: data.count > 0 ? Math.round((data.accurate / data.count) * 100) : 0,
        avgCents: Math.round(data.totalCents / data.count),
      }))
      .sort((a, b) => b.count - a.count);

    setChartData(sorted.slice(0, 12));
  };

  const exportCSV = () => {
    if (sessions.length === 0) return;
    const rows: string[] = ['نت,اکتاو,فرکانس,سنت,دقیق,جلسه,تاریخ'];
    sessions.forEach((s) => {
      s.notes.forEach((n) => {
        rows.push(`${n.solfege},${n.noteName ? '' : ''},${n.noteName},,,${n.cents},${n.isAccurate ? 'بله' : 'خیر'},${s.name},${s.createdAt}`);
      });
    });
    // Simpler: just export note data
    const csvRows: string[] = ['نت,سنت,دقیق'];
    sessions.forEach((s) => {
      s.notes.forEach((n) => {
        csvRows.push(`${n.solfege},${n.cents},${n.isAccurate ? 'بله' : 'خیر'}`);
      });
    });
    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `solfeggio-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalNotes = sessions.reduce((acc, s) => acc + s.notes.length, 0);
  const totalAccurate = sessions.reduce((acc, s) => acc + s.notes.filter((n) => n.isAccurate).length, 0);
  const overallAccuracy = totalNotes > 0 ? Math.round((totalAccurate / totalNotes) * 100) : 0;

  if (!expanded) {
    return (
      <Card
        className="border-dashed border-2 border-border/40 bg-gradient-to-br from-violet-500/5 to-fuchsia-500/5 hover:border-violet-300/50 transition-all duration-300 group cursor-pointer"
        onClick={() => setExpanded(true)}
      >
        <CardContent className="p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/20 group-hover:shadow-violet-500/40 transition-shadow">
            <BarChart3 className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold">نمودار عملکرد</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              تحلیل دقت نت‌ها در تمام جلسات
            </p>
          </div>
          <div className="text-left">
            {totalNotes > 0 && (
              <Badge variant="outline" className={cn(
                'text-xs font-mono',
                overallAccuracy >= 80 ? 'border-emerald-300/50 text-emerald-600' : 'border-amber-300/50 text-amber-600'
              )}>
                {overallAccuracy}٪
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border/40 shadow-lg shadow-black/[0.03] bg-card/90 backdrop-blur-sm">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-violet-500" />
            نمودار عملکرد
          </CardTitle>
          <div className="flex items-center gap-1">
            {totalNotes > 0 && (
              <Button variant="outline" size="sm" onClick={exportCSV} className="h-7 text-[11px] gap-1">
                <Download className="h-3 w-3" />
                خروجی CSV
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setExpanded(false)} className="h-7 text-xs text-muted-foreground">
              بستن
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <BarChart3 className="h-10 w-10 opacity-20 mb-2" />
            <p className="text-sm">هنوز داده‌ای ثبت نشده</p>
            <p className="text-xs opacity-60">پس از تمرین اینجا نمودار عملکرد نمایش داده می‌شود</p>
          </div>
        ) : (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-muted/30 rounded-lg p-2 text-center">
                <div className="text-lg font-bold tabular-nums">{totalNotes}</div>
                <div className="text-[10px] text-muted-foreground">کل نت‌ها</div>
              </div>
              <div className="bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg p-2 text-center">
                <div className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{totalAccurate}</div>
                <div className="text-[10px] text-muted-foreground">تمیز</div>
              </div>
              <div className={cn(
                'rounded-lg p-2 text-center',
                overallAccuracy >= 80 ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : 'bg-amber-50/50 dark:bg-amber-950/20'
              )}>
                <div className={cn(
                  'text-lg font-bold tabular-nums',
                  overallAccuracy >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                )}>
                  {overallAccuracy}٪
                </div>
                <div className="text-[10px] text-muted-foreground">دقت کلی</div>
              </div>
            </div>
            {/* Bar chart */}
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ right: 20, left: 10, top: 5, bottom: 5 }}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={50} tick={{ fontSize: 11, fontFamily: 'inherit' }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border))',
                      background: 'hsl(var(--card))',
                      fontSize: '12px',
                    }}
                    formatter={(value: number, name: string) => [`${value}٪`, 'دقت']}
                  />
                  <Bar dataKey="accuracy" radius={[0, 6, 6, 0]} maxBarSize={24}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.accuracy >= 80 ? 'hsl(142, 71%, 45%)' : entry.accuracy >= 50 ? 'hsl(45, 93%, 47%)' : 'hsl(0, 84%, 60%)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
            </div>
            {/* Per-note detail */}
            <div className="mt-4 space-y-1">
              <div className="text-[10px] text-muted-foreground mb-1.5">میانگین فاصله از نت درست (سنت)</div>
              <div className="flex flex-wrap gap-1.5">
                {chartData.map((d) => (
                  <div
                    key={d.name}
                    className={cn(
                      'px-2 py-0.5 rounded-md text-[10px] font-mono border',
                      d.avgCents <= 8 ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800/30'
                      : d.avgCents <= 15 ? 'bg-yellow-50 text-yellow-600 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800/30'
                      : 'bg-red-50 text-red-500 border-red-200 dark:bg-red-950/20 dark:border-red-800/30'
                    )}
                  >
                    {d.name}: {d.avgCents}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
