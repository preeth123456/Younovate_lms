// src/components/trainee/TraineeLayout.jsx
import React from 'react';
import SidebarLayout from '../shared/SidebarLayout';

const NAV = [
  {
    label: 'My Learning',
    items: [
      { to: '/trainee/dashboard',   icon: 'layout-dashboard', label: 'Dashboard'   },
      { to: '/trainee/courses',     icon: 'book',             label: 'My Courses'  },
      { to: '/trainee/sessions',    icon: 'video',            label: 'Sessions'    },
      { to: '/trainee/attendance',  icon: 'user-check',       label: 'Attendance'  },
      { to: '/trainee/assignments', icon: 'clipboard-list',   label: 'Assignments' },
      { to: '/trainee/module-assessments', icon: 'file-analytics', label: 'Assessments' },
      { to: '/trainee/feedback',    icon: 'star',             label: 'Feedback'    },
    ],
  },
  {
    label: 'Progress',
    items: [
      { to: '/trainee/progress',      icon: 'chart-line',       label: 'My Progress' },
      { to: '/trainee/lms-certificates', icon: 'certificate',   label: 'LMS Certificates' },
      { to: '/trainee/certificates',  icon: 'certificate',      label: 'Certificates' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/trainee/settings',    icon: 'settings',         label: 'Settings'    },
    ],
  },
];

export default function TraineeLayout() {
  return <SidebarLayout navItems={NAV} title="Youva OS" />;
}

