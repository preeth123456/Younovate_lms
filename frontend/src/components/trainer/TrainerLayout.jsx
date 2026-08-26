import React from 'react';
import SidebarLayout from '../shared/SidebarLayout';

const NAV = [
  {
    label: 'Overview',
    items: [
      { to: '/trainer/dashboard',  icon: 'layout-dashboard', label: 'Dashboard' },
    ],
  },
  {
    label: 'Teaching',
    items: [
      { to: '/trainer/sessions',   icon: 'video',           label: 'Sessions'   },
      { to: '/trainer/attendance', icon: 'clipboard-check', label: 'Attendance' },
      { to: '/trainer/recordings', icon: 'record-actor',    label: 'Recordings' },
      { to: '/trainer/feedback',   icon: 'star',            label: 'Feedback'   },
      { to: '/trainer/batches',    icon: 'stack-2',         label: 'My Batches' },
    ],
  },
  {
    label: 'Workshops',
    items: [
      { to: '/trainer/workshops',              icon: 'writing',        label: 'My Workshops'       },
      { to: '/trainer/workshop-batches',       icon: 'stack-2',        label: 'My Batches'         },
      { to: '/trainer/workshops/live',         icon: 'video',          label: 'Live Workshop'      },
      { to: '/trainer/workshops/attendance',  icon: 'clipboard-check', label: 'Attendance'       },
      { to: '/trainer/workshops/participants', icon: 'users',          label: 'Participants'       },
      { to: '/trainer/workshops/resources',    icon: 'books',          label: 'Workshop Resources' },
       { to: '/trainer/workshops/feedback',     icon: 'star',           label: 'Feedback'           },
       { to: '/trainer/workshops/certificates', icon: 'certificate',    label: 'Certificates'       },
       { to: '/trainer/recordings?sessionType=WORKSHOP', icon: 'video',    label: 'Recorded Videos'   },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/trainer/settings',   icon: 'settings',        label: 'Settings'   },
    ],
  },
];

export default function TrainerLayout() {
  return <SidebarLayout navItems={NAV} title="Youva OS Trainer" />;
}
