// src/components/hr/HRLayout.jsx — 11 primary HR menus (preserves SidebarLayout design)
import React, { useEffect, useState } from 'react';
import SidebarLayout from '../shared/SidebarLayout';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';
export default function HRLayout() {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let on = true;
    const load = async () => {
      try {
        const t = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!t) return;
        const { data } = await axios.get(`${API_BASE_URL}/api/notifications/unread-count`, { headers: { Authorization: `Bearer ${t}` } });
        if (on) setUnread(data.count || 0);
      } catch {}
    };
    load();
    const i = setInterval(load, 30000);
    return () => { on = false; clearInterval(i); };
  }, []);
  const NAV = [
    { label: 'HR', items: [
      { to: '/hr/dashboard', icon: 'layout-dashboard', label: 'Dashboard' },
      { to: '/hr/candidates', icon: 'users', label: 'Candidates' },
      { to: '/hr/companies', icon: 'briefcase', label: 'Companies' },
      { to: '/hr/jobs', icon: 'folder', label: 'Job Openings' },
      { to: '/hr/interviews', icon: 'calendar-event', label: 'Interviews' },
      { to: '/hr/evaluations', icon: 'clipboard-check', label: 'Evaluations' },
      { to: '/hr/offers', icon: 'send', label: 'Offers' },
      { to: '/hr/placements', icon: 'award', label: 'Placements' },
      { to: '/hr/reports', icon: 'file-analytics', label: 'Reports' },
      { to: '/hr/notifications', icon: 'bell', label: 'Notifications', badge: unread },
      { to: '/hr/settings', icon: 'settings', label: 'Settings' },
    ] },
  ];
  return <SidebarLayout navItems={NAV} title="Youva OS HR" />;
}

