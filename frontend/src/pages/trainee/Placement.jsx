// src/pages/trainee/Placement.jsx — read-only placement result (consumes /api/trainee/placement; HR writes)
import React,{useEffect,useState} from 'react';
import axios from 'axios';import {API_BASE_URL} from '../../config/api';
export default function TraineePlacement(){
const [d,setD]=useState(null);const [st,setSt]=useState('loading');
useEffect(()=>{let on=true;const run=async()=>{try{const t=localStorage.getItem('token')||sessionStorage.getItem('token');const {data}=await axios.get(`${API_BASE_URL}/api/trainee/placement`,{headers:t?{Authorization:`Bearer ${t}`}:{}});if(on){setD(data);setSt('ok');}}catch{ if(on)setSt('err');}};run();return()=>{on=false;};},[]);
if(st==='loading')return(<div style={{padding:24}}>Loading placement…</div>);
if(st==='err')return(<div style={{padding:24}}>Unable to load placement.</div>);
return(<div style={{padding:24,fontFamily:'Public Sans,system-ui'}}><h2 style={{margin:0}}>My Placement</h2><p style={{color:'#64748B'}}>Status: <b>{String(d.status||'—').replace(/_/g,' ')}</b>{d.companyName?` · ${d.companyName}`:''}{d.ctc?` · ${d.ctc}`:''}</p>
{(d.placements||[]).length>0&&(<div>{d.placements.map((p)=>(<div key={p._id} style={{background:'#fff',border:'1px solid #E2E8F0',borderRadius:12,padding:14,marginBottom:10}}><b>{p.company?.name||''}</b> · {p.role||''} · {p.ctc||''} · {p.status}</div>))}</div>)}
{(d.offers||[]).length>0&&(<div><h3>Offers</h3>{d.offers.map((o)=>(<div key={o._id} style={{fontSize:13}}>{o.company?.name||''} · {o.ctc||''} · {o.status}</div>))}</div>)}
{(d.interviews||[]).length>0&&(<div><h3>Interviews</h3>{d.interviews.map((v)=>(<div key={v._id} style={{fontSize:13}}>{new Date(v.scheduledAt).toLocaleString('en-IN')} · {v.company?.name||''} · {v.status}</div>))}</div>)}
{(d.placements||[]).length===0&&(d.offers||[]).length===0&&(d.interviews||[]).length===0&&(<p style={{color:'#64748B'}}>No placement activity yet.</p>)}</div>);}
