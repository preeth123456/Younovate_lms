// src/components/admin/AdminLayout.jsx
// ✅ Correct import path: ../shared/SidebarLayout
//    (from components/admin/ → up one → shared/)
//
// Nav supports two shapes:
//   Flat item:   { to, icon, label, badge? }
//   Sub-menu:    { icon, label, children: [{ to, icon, label, badge? }] }

import React from 'react';
import SidebarLayout from '../shared/SidebarLayout';

const NAV = [
  {
    label: 'Overview',
    items: [
      { to: '/admin/dashboard', icon: 'layout-dashboard', label: 'Dashboard' },
    ],
  },
  {
    label: 'Management',
    items: [
      { to: '/admin/batches',       icon: 'stack-2',       label: 'Batches'       },
      { to: '/admin/courses',       icon: 'books',         label: 'Courses'       },
      {
        icon: 'users',
        label: 'Users',
        children: [
          { to: '/admin/users',     icon: 'user',          label: 'All Users'     },
          { to: '/admin/trainees',  icon: 'school',        label: 'Trainees'      },
          { to: '/admin/trainers',  icon: 'chalkboard',    label: 'Trainers'      },
        ],
      },
      { to: '/admin/sessions',      icon: 'video',         label: 'Sessions'      },
      { to: '/admin/attendance',    icon: 'calendar-check', label: 'Attendance'    },
      { to: '/admin/assignments',   icon: 'clipboard-list', label: 'Assignments'   },
      { to: '/admin/module-assessments', icon: 'file-analytics', label: 'Assessments' },
      { to: '/admin/feedback',      icon: 'star',           label: 'Feedback'      },
      { to: '/admin/certificates',  icon: 'certificate',    label: 'Certificates'  },
      { to: '/admin/registrations', icon: 'clipboard-list',label: 'Registrations' },
    ],
  },
  {
    label: 'Placement',
    items: [
      {
        icon: 'git-merge',
        label: 'Placement',
        children: [
          { to: '/admin/pipeline',   icon: 'arrows-right',   label: 'Pipeline'   },
          { to: '/admin/interviews', icon: 'calendar-event', label: 'Interviews' },
        ],
      },
    ],
  },
  {
    label: 'Workshops',
    items: [
      {
        icon: 'writing',
        label: 'Workshops',
        children: [
          { to: '/admin/workshops/dashboard',   icon: 'layout-dashboard', label: 'Dashboard'          },
          { to: '/admin/workshops/management',     icon: 'list',             label: 'Workshop Management'  },
          { to: '/admin/workshops/registrations',   icon: 'clipboard-list',   label: 'Registrations'        },
          { to: '/admin/workshops/batches',         icon: 'stack-2',          label: 'Workshop Batches'     },
          { to: '/admin/workshops/live-sessions',   icon: 'video',            label: 'Live Sessions'        },
          { to: '/admin/workshops/attendance',  icon: 'users',            label: 'Attendance'          },
          { to: '/admin/workshops/feedback',    icon: 'star',             label: 'Feedback'            },
          { to: '/admin/workshops/certificates',icon: 'certificate',      label: 'Certificates'        },
          { to: '/admin/workshops/reports',     icon: 'file-analytics',   label: 'Reports'             },
        ],
      },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/admin/settings', icon: 'settings', label: 'Settings' },
    ],
  },
];

export default function AdminLayout() {
  return <SidebarLayout navItems={NAV} title="Youva OS Admin" />;
}

