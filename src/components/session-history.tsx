'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { History, Trash2, Calendar, Target, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';

interface SessionNote {
  id: string;
  noteName: string;
  solfege: string;
  octave: number;
  frequency: number;
  cents: number;
  isAccurate: boolean;
  createdAt: string;
}

interface Session {
  id: string;
  name: string;
  createdAt: string;
  notes: SessionNote[];
}

interface SessionHistoryProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SessionHistory({ isOpen, onClose }: SessionHistoryProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/solfeggio/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteSession = useCallback(async (id: string) => {
    try {
      await fetch(`/api/solfeggio/sessions/${id}`, { method: 'DELETE' });
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (selectedSession?.id === id) setSelectedSession(null);
    } catch (err) {
      console.error('Error deleting session:', err);
    }
  }, [selectedSession]);

  useEffect(() => {
    if (isOpen) fetchSessions();
  }, [isOpen, fetchSessions]);

  if (!isOpen) return null;

  const getStats = (notes: SessionNote[]) => {
    const total = notes.length;
    const accurate = notes.filter((n) => n.isAccurate).length;
    const accuracy = total > 0 ? Math.round((accurate / total) * 100) : 0;
    return { total, accurate, accuracy };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="w-full max-w-2xl max-h-[85vh]"
      >
      <Card className="w-full max-h-[85vh] flex flex-col shadow-2xl shadow-black/20 border-border/50" dir="rtl">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/20">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-sky-500 to-cyan-500 flex items-center justify-center">
              <History className="h-4 w-4 text-white" />
            </div>
            تاریخچه جلسات
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            بستن
          </Button>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              در حال بارگذاری...
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center">
                <BarChart3 className="h-7 w-7 opacity-30" />
              </div>
              <p className="text-sm font-medium">هنوز جلسه‌ای ثبت نشده</p>
              <p className="text-xs opacity-50">پس از تمرین، جلسات اینجا ذخیره می‌شوند</p>
            </div>
          ) : selectedSession ? (
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedSession(null)}
                >
                  ← بازگشت به لیست
                </Button>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {new Date(selectedSession.createdAt).toLocaleDateString('fa-IR')}
                </div>
              </div>

              {/* Session stats */}
              {(() => {
                const st = getStats(selectedSession.notes);
                return (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-muted/50 rounded-xl p-3 text-center">
                      <div className="text-xl font-bold">{st.total}</div>
                      <div className="text-xs text-muted-foreground">کل نت‌ها</div>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-3 text-center">
                      <div className="text-xl font-bold text-emerald-500">{st.accurate}</div>
                      <div className="text-xs text-muted-foreground">نت‌های تمیز</div>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-3 text-center">
                      <div className={cn(
                        'text-xl font-bold',
                        st.accuracy >= 80 ? 'text-emerald-500' :
                        st.accuracy >= 50 ? 'text-yellow-500' : 'text-red-500'
                      )}>{st.accuracy}%</div>
                      <div className="text-xs text-muted-foreground">دقت</div>
                    </div>
                  </div>
                );
              })()}

              {/* Notes list */}
              <ScrollArea className="flex-1 max-h-[350px]">
                <div className="flex flex-col gap-1">
                  {selectedSession.notes.map((note) => (
                    <div
                      key={note.id}
                      className="flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-muted/50"
                    >
                      <span className={cn(
                        'text-sm font-bold min-w-[50px]',
                        note.isAccurate ? 'text-emerald-600' : 'text-foreground'
                      )}>
                        {note.solfege}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {note.noteName}{note.octave}
                      </span>
                      <div className="flex-1" />
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[11px] font-mono px-1.5 py-0',
                          Math.abs(note.cents) <= 5 ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                          Math.abs(note.cents) <= 10 ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' :
                          'bg-red-500/10 text-red-600 border-red-500/20'
                        )}
                      >
                        {note.cents > 0 ? '+' : ''}{note.cents} سنت
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="flex flex-col gap-2">
                {sessions.map((session) => {
                  const st = getStats(session.notes);
                  return (
                    <div
                      key={session.id}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border/40 bg-card hover:bg-muted/30 hover:border-border/60 cursor-pointer transition-all duration-200"
                      onClick={() => setSelectedSession(session)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{session.name}</div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(session.createdAt).toLocaleDateString('fa-IR')}
                          </span>
                          <span className="flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            {st.total} نت
                          </span>
                        </div>
                      </div>
                      <div className={cn(
                        'text-lg font-bold min-w-[48px] text-center',
                        st.accuracy >= 80 ? 'text-emerald-500' :
                        st.accuracy >= 50 ? 'text-yellow-500' : 'text-red-500'
                      )}>
                        {st.accuracy}%
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-500"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSession(session.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      </motion.div>
    </div>
  );
}
