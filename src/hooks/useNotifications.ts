import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Notification } from '../types';

export function useNotifications() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          // Token might be expired, AuthContext should handle this but let's be safe
          return;
        }
        throw new Error(`Server responded with ${res.status}`);
      }

      const data = await res.json();
      if (Array.isArray(data)) {
        setNotifications(data);
        setUnreadCount(data.filter((n: Notification) => n.read_status === 0).length);
      }
    } catch (err) {
      // Only log if it's not a network error during development/restarts
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        // Silent fail for network errors to avoid console spam during server restarts
        return;
      }
      console.error('Failed to fetch notifications:', err);
    }
  };

  const markAsRead = async () => {
    if (!token) return;
    try {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setUnreadCount(0);
      setNotifications(notifications.map(n => ({ ...n, read_status: 1 })));
    } catch (err) {
      console.error('Failed to mark notifications as read', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [token]);

  return { notifications, unreadCount, markAsRead, refresh: fetchNotifications };
}
