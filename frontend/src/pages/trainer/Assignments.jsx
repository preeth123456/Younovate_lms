import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppSelector } from '../../app/hooks';
import { selectToken } from '../../features/auth/authSlice';
import { API_BASE_URL } from '../../config/api';

const TrainerAssignments = () => {
  const token = useAppSelector(selectToken);
  const [assignments, setAssignments] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setStatus('loading');
      try {
        // Same auth pattern as every working slice: Redux token first
        // (always set on login), localStorage only as "Remember me" fallback.
        // Same absolute API base; same { success, assignments: [...] } shape.
        const t = token || localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/api/assignments`, {
          headers: { Authorization: `Bearer ${t}` },
        });
        if (!res.ok) throw new Error('Failed to fetch assignments');
        const data = await res.json();
        setAssignments(Array.isArray(data) ? data : (data.assignments || []));
        setStatus('succeeded');
      } catch (err) {
        setError(err.message);
        setStatus('failed');
      }
    };
    fetchData();
  }, [token]);

  if (status === 'loading') return <div className="p-6 text-gray-500">Loading assignments…</div>;
  if (status === 'failed')  return <div className="p-6 text-red-500">Error: {error}</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">Assignments</h1>
      <p className="text-sm text-gray-500 mb-4">
        Session file assignments are below. Create module theory + practical assessments{' '}
        <Link to="/trainer/module-assessments" style={{ color: '#1d4ed8', fontWeight: 700 }}>here</Link>.
      </p>
      {assignments.length === 0 ? (
        <p className="text-gray-500">No assignments found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">#</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Title</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Due Date</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Submissions</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a, idx) => (
                <tr key={a._id || idx} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-700">{idx + 1}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{a.title || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {a.dueDate ? new Date(a.dueDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{a.submissions?.length ?? 0}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      a.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {a.status || 'N/A'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TrainerAssignments;