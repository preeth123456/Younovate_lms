// HR Overview - real /api/hr/overview data only
import React,{useCallback,useEffect,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {card,h2,sub,page,btnG,Badge,Empty,Loading,Err,fmtDT} from '../../components/hr/hrUi';
import {hrGet} from '../../features/hr/hrApi';
const BRAND='#3f7da0';
export default function HROverview(){
const nav=useNavigate();
const [d,setD]=useState(null);const [st,setSt]=useState('loading');const [err,setErr]=useState('');
const load=useCallback(async()=>{setSt('loading');setErr('');try{const r=await hrGet('/overview');setD(r);setSt('ok');}catch(e){setErr(e.response?.data?.message||'Unable to load.');setSt('err');}},[]);
useEffect(()=>{load();},[load]);
const k=d?.kpis||{};const pipe=d?.pipeline||{};
const stages=[['enrolled','Eligible'],['training','Screening'],['ready','Shortlisted'],['interview_scheduled','Int. Scheduled'],['interview_done','Int. Done'],['offer_extended','Offer'],['placed','Placed']];
return(<div style={page}>
<div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap',marginBottom:16}}><div><h2 style={h2}>HR Dashboard</h2><p style={sub}>Placement and candidate management overview</p></div><div style={{display:'flex',gap:8,alignItems:'center'}}><span style={{fontSize:12,color:'#64748B',fontWeight:700}}>{new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</span><button type="button" onClick={load} style={btnG}>Refresh</button></div></div>
{st==='loading'&&<Loading text="Loading HR dashboard…"/>}
{st==='err'&&<Err text={err} onRetry={load}/>}
{st==='ok'&&(<>
<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:14}}>
{[['Total',k.totalCandidates,'/hr/candidates'],['Active',k.activeCandidates,'/hr/candidates?tab=pipeline'],['Interviews',k.upcomingInterviews,'/hr/interviews?f=upcoming'],['Eval Pending',k.pendingEvaluations,'/hr/evaluations?f=pending'],['Selected',k.selected,'/hr/candidates?tab=selected'],['Offers',k.offers,'/hr/offers'],['Placed',k.placed,'/hr/placements']].map((x)=>(<button key={x[0]} type="button" onClick={()=>nav(x[2])} style={{...card,textAlign:'left',cursor:'pointer'}}><div style={{fontSize:12,fontWeight:700,color:'#64748B'}}>{x[0]}</div><div style={{fontSize:28,fontWeight:800,color:BRAND}}>{x[1]??0}</div></button>))}
</div>
<div style={{...card,marginBottom:14}}><h3 style={{margin:'0 0 12px',fontSize:15,fontWeight:800}}>Pipeline (unique candidates)</h3><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{stages.map((s)=>(<div key={s[0]} style={{flex:'1 1 110px',background:'#F8FAFC',border:'1px solid #E2E8F0',borderRadius:10,padding:12}}><div style={{fontSize:12,fontWeight:700,color:'#475569'}}>{s[1]}</div><div style={{fontSize:22,fontWeight:800}}>{pipe[s[0]]||0}</div></div>))}</div></div>
<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:12}}>
<div style={card}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}><h3 style={{margin:0,fontSize:15,fontWeight:800}}>Upcoming Interviews</h3><button type="button" style={btnG} onClick={()=>nav('/hr/interviews?f=upcoming')}>View</button></div>{(d.upcoming||[]).length===0?<Empty text="No upcoming interviews."/>:(d.upcoming||[]).slice(0,6).map((u)=>(<div key={u._id} style={{display:'flex',justifyContent:'space-between',gap:8,padding:'9px 0',borderBottom:'1px solid #F1F5F9',fontSize:13}}><div><b>{u.candidate}</b><div style={{color:'#64748B',fontSize:12}}>{u.company} · {u.role} · {u.round}</div></div><div style={{textAlign:'right'}}><div style={{fontWeight:700}}>{fmtDT(u.scheduledAt)}</div><Badge v={u.status}/></div></div>))}</div>
<div style={card}><h3 style={{margin:'0 0 10px',fontSize:15,fontWeight:800}}>Pending Actions</h3>{[['Evaluations pending',k.pendingEvaluations,'/hr/evaluations?f=pending'],['In screening',(pipe.enrolled||0)+(pipe.training||0),'/hr/candidates?tab=eligible'],['Offers active',k.offers,'/hr/offers'],['Placed',k.placed,'/hr/placements']].map((r)=>(<div key={r[0]} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 0',borderBottom:'1px solid #F1F5F9',fontSize:13}}><span><b>{r[1]??0}</b> · {r[0]}</span><button type="button" style={btnG} onClick={()=>nav(r[2])}>Review</button></div>))}<h3 style={{margin:'16px 0 10px',fontSize:15,fontWeight:800}}>Quick Actions</h3><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button type="button" style={btnG} onClick={()=>nav('/hr/candidates')}>Candidates</button><button type="button" style={btnG} onClick={()=>nav('/hr/interviews')}>Schedule Interview</button><button type="button" style={btnG} onClick={()=>nav('/hr/companies')}>Add Company</button><button type="button" style={btnG} onClick={()=>nav('/hr/jobs')}>Create Job</button><button type="button" style={btnG} onClick={()=>nav('/hr/placements')}>Placements</button></div></div>
</div></>)}
</div>);}
