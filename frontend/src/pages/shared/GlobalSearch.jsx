import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';

const API = API_BASE_URL;

const TYPE_LABEL = {
  course: 'Course',
  session: 'Session',
  workshop: 'Workshop',
  user: 'User',
  batch: 'Batch',
  trainee: 'Trainee',
};

export default function GlobalSearch() {
  const [searchParams] = useSearchParams();
  const q = (searchParams.get('q') || '').trim();

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!q) {
      setResults([]);
      setError('');
      return;
    }

    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const { data } = await axios.get(`${API}/api/search`, {
          params: { q },
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!cancelled) setResults(data.results || []);
      } catch (err) {
        if (!cancelled) {
          const status = err.response?.status;
          if (status === 401) {
            setError('Your session has expired. Please log in again.');
          } else {
            setError(err.response?.data?.message || 'Search failed. Please try again.');
          }
          setResults([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [q]);

  return (
    <div style={{ padding: '20px 28px', fontFamily: 'Public Sans, system-ui, sans-serif', background: '#F1F5F9', minHeight: '100vh' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>Search</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>
          {q ? `Results for “${q}”` : 'Enter a search term using the search bar above.'}
        </p>
      </div>

      {loading && <p style={{ color: '#64748B' }}>Searching…</p>}

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '12px 16px', color: '#B91C1C', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {!loading && !error && q && results.length === 0 && (
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 32, textAlign: 'center' }}>
          <p style={{ margin: 0, fontWeight: 700, color: '#0F172A' }}>No results found</p>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748B' }}>Try a different keyword.</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden' }}>
          {results.map((item, idx) => (
            <Link
              key={`${item.type}-${item.href}-${idx}`}
              to={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '14px 18px',
                borderBottom: idx < results.length - 1 ? '1px solid #F1F5F9' : 'none',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div>
                <p style={{ margin: 0, fontWeight: 700, color: '#0F172A', fontSize: 14 }}>{item.title}</p>
                {item.subtitle && (
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748B' }}>{item.subtitle}</p>
                )}
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#4F46E5', background: '#EEF2FF', padding: '3px 8px', borderRadius: 99, flexShrink: 0 }}>
                {TYPE_LABEL[item.type] || item.type}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
