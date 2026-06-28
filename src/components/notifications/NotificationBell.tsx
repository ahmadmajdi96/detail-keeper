import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications, type Notification } from '@/contexts/NotificationContext';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

// Map a notification to a route + element id to scroll to.
function targetForNotification(n: Notification): { path: string; hash?: string } {
  const d = (n.data || {}) as Record<string, any>;
  switch (n.type) {
    case 'defect_assigned':
    case 'defect_created':
    case 'defect_status':
      return { path: '/defects', hash: d.defect_id ? `defect-${d.defect_id}` : undefined };
    case 'execution_completed':
      return { path: '/executions', hash: d.execution_id ? `execution-${d.execution_id}` : undefined };
    case 'test_plan_created':
      return d.test_plan_id
        ? { path: `/test-plans/${d.test_plan_id}` }
        : { path: '/test-plans' };
    case 'document_ready':
    case 'document_failed':
      return { path: '/documents', hash: d.document_id ? `document-${d.document_id}` : undefined };
    case 'project_created':
    case 'project_ready':
    case 'project_failed':
      return d.project_id
        ? { path: `/projects/${d.project_id}` }
        : { path: '/projects' };
    case 'workspace_invite':
    case 'member_added':
      return d.workspace_id
        ? { path: `/workspaces/${d.workspace_id}` }
        : { path: '/workspaces' };
    default:
      return { path: '/notifications' };
  }
}

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'defect_assigned':
      case 'defect_created':
      case 'defect_status':
        return '🐛';
      case 'execution_completed':
        return '✅';
      case 'test_plan_created':
        return '📋';
      case 'document_ready':
        return '📄';
      case 'document_failed':
        return '⚠️';
      case 'project_created':
      case 'project_ready':
        return '📁';
      case 'workspace_invite':
      case 'member_added':
        return '👥';
      default:
        return '🔔';
    }
  };

  const handleClick = (n: Notification) => {
    if (!n.read) markAsRead(n.id);
    const { path, hash } = targetForNotification(n);
    setOpen(false);
    navigate(path);
    if (hash) {
      // Wait for the destination page to render the element, then scroll to it.
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold">Notifications</h4>
          <div className="flex gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllAsRead()}
                className="text-xs h-7"
              >
                <Check className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearAll()}
                className="text-xs h-7 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors cursor-pointer relative group',
                    !notification.read && 'bg-accent/5'
                  )}
                  onClick={() => handleClick(notification)}
                >
                  <span className="text-lg">{getNotificationIcon(notification.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-sm font-medium truncate',
                      !notification.read && 'text-foreground'
                    )}>
                      {notification.title}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(notification.id);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
