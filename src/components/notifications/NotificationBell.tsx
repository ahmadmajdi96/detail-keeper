import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, Trash2, X, AtSign, UserCheck, Activity, Inbox, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useNotifications, type Notification } from '@/contexts/NotificationContext';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

function targetForNotification(n: Notification): { path: string; hash?: string } {
  const d = (n.data || {}) as Record<string, any>;
  if (d.link && typeof d.link === 'string') {
    const [p, h] = d.link.split('#');
    return { path: p, hash: h };
  }
  switch (n.type) {
    case 'defect_assigned':
    case 'defect_created':
    case 'defect_status':
    case 'mention':
      return d.defect_id
        ? { path: '/defects', hash: `defect-${d.defect_id}` }
        : { path: '/defects' };
    case 'execution_completed':
      return { path: '/executions', hash: d.execution_id ? `execution-${d.execution_id}` : undefined };
    case 'test_plan_created':
      return d.test_plan_id ? { path: `/test-plans/${d.test_plan_id}` } : { path: '/test-plans' };
    case 'document_ready':
    case 'document_failed':
      return { path: '/documents', hash: d.document_id ? `document-${d.document_id}` : undefined };
    case 'project_created':
    case 'project_ready':
    case 'project_failed':
      return d.project_id ? { path: `/projects/${d.project_id}` } : { path: '/projects' };
    case 'workspace_invite':
    case 'member_added':
      return d.workspace_id ? { path: `/workspaces/${d.workspace_id}` } : { path: '/workspaces' };
    case 'cycle_run_completed':
    case 'cycle_run_cancelled':
    case 'runner_job_succeeded':
    case 'runner_job_failed':
      return { path: '/runners' };
    case 'build_success':
    case 'build_failed':
      return { path: '/builds' };
    default:
      return { path: '/notifications' };
  }
}

const ICONS: Record<string, string> = {
  defect_assigned: '🎯',
  defect_created: '🐛',
  defect_status: '🔄',
  mention: '💬',
  execution_completed: '✅',
  test_plan_created: '📋',
  document_ready: '📄',
  document_failed: '⚠️',
  project_created: '📁',
  project_ready: '📁',
  project_failed: '❌',
  workspace_invite: '👥',
  member_added: '👥',
  cycle_run_completed: '🚀',
  cycle_run_cancelled: '🛑',
  build_success: '🟢',
  build_failed: '🔴',
  runner_job_succeeded: '⚙️',
  runner_job_failed: '⚠️',
  info: 'ℹ️',
};

type TabKey = 'all' | 'mentions' | 'assigned' | 'activity';

function classify(n: Notification): TabKey {
  if (n.type === 'mention') return 'mentions';
  if (n.type === 'defect_assigned' || n.type === 'workspace_invite' || n.type === 'member_added')
    return 'assigned';
  return 'activity';
}

export function NotificationBell() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    markManyAsRead,
    deleteNotification,
    deleteMany,
    clearAll,
  } = useNotifications();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>('all');
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    if (tab === 'all') return notifications;
    return notifications.filter((n) => classify(n) === tab);
  }, [tab, notifications]);

  const counts = useMemo(() => {
    const c = { mentions: 0, assigned: 0, activity: 0 };
    for (const n of notifications) {
      if (n.read) continue;
      const k = classify(n);
      c[k] += 1;
    }
    return c;
  }, [notifications]);

  const visibleUnreadIds = useMemo(
    () => filtered.filter((n) => !n.read).map((n) => n.id),
    [filtered]
  );
  const visibleIds = useMemo(() => filtered.map((n) => n.id), [filtered]);

  const handleClick = (n: Notification) => {
    if (!n.read) markAsRead(n.id);
    const { path, hash } = targetForNotification(n);
    setOpen(false);
    navigate(path);
    if (hash) {
      setTimeout(() => {
        const el = document.getElementById(hash);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-accent', 'ring-offset-2', 'rounded-md');
          setTimeout(() => {
            el.classList.remove('ring-2', 'ring-accent', 'ring-offset-2', 'rounded-md');
          }, 2400);
        }
      }, 450);
    }
  };

  const renderList = (items: Notification[]) => (
    <ScrollArea className="h-[360px]">
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[320px] text-muted-foreground gap-2">
          <Inbox className="h-10 w-10 opacity-40" />
          <p className="text-sm">You're all caught up</p>
        </div>
      ) : (
        <div className="divide-y">
          {items.map((n) => (
            <div
              key={n.id}
              className={cn(
                'flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors cursor-pointer relative group',
                !n.read && 'bg-accent/5'
              )}
              onClick={() => handleClick(n)}
            >
              <span className="text-lg shrink-0 mt-0.5">{ICONS[n.type] ?? '🔔'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={cn('text-sm font-medium truncate', !n.read && 'text-foreground')}>
                    {n.title}
                  </p>
                  {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                  <Badge variant="outline" className="text-[9px] uppercase h-4 px-1">
                    {n.type.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-2"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteNotification(n.id);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </ScrollArea>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b bg-gradient-to-r from-accent/5 to-transparent">
          <div>
            <h4 className="font-semibold text-sm">Activity Center</h4>
            <p className="text-[11px] text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </p>
          </div>
          <div className="flex gap-1">
            {visibleUnreadIds.length > 0 && tab !== 'all' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markManyAsRead(visibleUnreadIds)}
                className="text-xs h-7"
                title={`Mark ${visibleUnreadIds.length} as read`}
              >
                <CheckCheck className="h-3 w-3 mr-1" /> Mark tab read
              </Button>
            )}
            {unreadCount > 0 && tab === 'all' && (
              <Button variant="ghost" size="sm" onClick={() => markAllAsRead()} className="text-xs h-7">
                <Check className="h-3 w-3 mr-1" /> Mark all read
              </Button>
            )}
            {visibleIds.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => (tab === 'all' ? clearAll() : deleteMany(visibleIds))}
                className="text-xs h-7 text-destructive hover:text-destructive"
                title={tab === 'all' ? 'Clear all' : 'Clear tab'}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList className="w-full grid grid-cols-4 h-10 rounded-none bg-muted/30 border-b">
            <TabsTrigger value="all" className="text-xs gap-1.5">
              All
              {unreadCount > 0 && (
                <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="mentions" className="text-xs gap-1.5">
              <AtSign className="h-3 w-3" /> Mentions
              {counts.mentions > 0 && (
                <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                  {counts.mentions}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="assigned" className="text-xs gap-1.5">
              <UserCheck className="h-3 w-3" /> Assigned
              {counts.assigned > 0 && (
                <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                  {counts.assigned}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-xs gap-1.5">
              <Activity className="h-3 w-3" /> Activity
              {counts.activity > 0 && (
                <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                  {counts.activity}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="m-0">
            {renderList(filtered)}
          </TabsContent>
        </Tabs>

        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs h-8"
            onClick={() => {
              setOpen(false);
              navigate('/notifications');
            }}
          >
            View all notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
