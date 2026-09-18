// Trainee LMS assignment summary card (dashboard section; full flow on /trainee/assignments).
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';

const C = { accent: '#4F46E5', green: '#059669', amber: '#D97706', blue: '#1D4ED8', text3: '#6B7280', border: '#E5E7EB' };
const card = { background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 2px 8px rgba(0,0,0,.06)', marginBottom: 16 };
const pill = (s) => {
  const m = {
    Assigned: [C.amber, '#FEF3C7'],
    Downloaded: [C.blue, '#DBEAFE'],
    Uploaded: ['#6D28D9', '#EDE9FE'],
    'Assignment Completed': [C.green, '#DCFCE7'],
  };
  const v = m[s] || [C.text3, '#F3F4F6'];
  return { background: v[1], color: v[0], padding: '2px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700 };
};

export default function LmsAssignmentsCard() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    const t = localStorage.getItem('token') || '';
    axios.get(`${API_BASE_URL}/api/assignments`, { headers: t ? { Authorization: `Bearer ${t}` } : {} })
      .then(({ data }) => setRows((data.assignments || []).filter((a) => a.origin === 'lms-session').slice(0, 5)))
      .catch(() => {});
  }, []);
  if (!rows.length) return null;
  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>LMS Assignments</h3>
        <Link to="/trainee/assignments" style={{ fontSize: '0.78rem', fontWeight: 700, color: C.accent }}>View all</Link>
      </div>
      {rows.map((a) => (
        <div key={a._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
          <span style={{ fontWeight: 600 }}>{a.title}</span>
          <span style={pill(a.myStatus || 'Assigned')}>{a.myStatus || 'Assigned'}</span>
        </div>
      ))}
    </div>
  );
}
