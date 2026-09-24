// HR Evaluations - pending + completed, per-interview submit
import React,{useCallback,useEffect,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {card,h2,sub,page,inp,btnP,btnG,th,td,Badge,Empty,Loading,Err,fmtDT} from '../../components/hr/hrUi';
import {hrGet,hrPost} from '../../features/hr/hrApi';
export default function HREvaluations(){
const [sp]=useSearchParams();
const [f,setF]=useState(sp.get('f')||'pending');
const [d,setD]=useState(null);const [st,setSt]=useState('loading');const [err,setErr]=useState('');
const [form,setForm]=useState({interview:'',technical:70,problemSolving:70,communication:70,roleKnowledge:70,overallScore:70,recommendation:'selected',comments:''});
const load=useCallback(async()=>{setSt('loading');try{const r=await hrGet('/interview-evaluations',{status:f==='pending'?'pending':'',limit:25});setD(r);setSt('ok');}catch(e){setErr(e.response?.data?.message||'Unable to load.');setSt('err');}},[f]);
useEffect(()=>{load();},[load]);
const save=async()=>{if(!form.interview)return alert('Select interview');try{await hrPost('/interview-evaluations',form);setForm({interview:'',technical:70,problemSolving:70,communication:70,roleKnowledge:70,overallScore:70,recommendation:'selected',comments:''});load();}catch(e){alert(e.response?.data?.message||'Failed');}};
return(<div style={page}>
<div style={{marginBottom:14}}><h2 style={h2}>Evaluations</h2><p style={sub}>Interview evaluations and selection</p></div>
<div style={{display:'flex',gap:8,marginBottom:12}}>{[['pending','Pending'],['completed','Completed']].map((t)=>(<button key={t[0]} type="button" onClick={()=>setF(t[0])} style={{...btnG,background:f===t[0]?'#3f7da0':'#fff',color:f===t[0]?'#fff':'#0F172A'}}>{t[1]}</button>))}</div>
{f==='pending'&&(<div style={{...card,marginBottom:12}}><h3 style={{marginTop:0}}>Submit Evaluation</h3><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:10}}>
<select style={inp} value={form.interview} onChange={(e)=>setForm({...form,interview:e.target.value})}><option value="">Completed interview *</option>{(d?.pending||[]).map((p)=>(<option key={p._id} value={p._id}>{p.trainee?.name} · {p.company?.name} · {fmtDT(p.scheduledAt)}</option>))}</select>
{[['technical','Technical'],['problemSolving','Problem Solving'],['communication','Communication'],['roleKnowledge','Role Knowledge'],['overallScore','Overall']].map((x)=>(<label key={x[0]} style={{fontSize:12}}>{x[1]}<input style={{...inp,width:'100%'}} type="number" min="0" max="100" value={form[x[0]]} onChange={(e)=>setForm({...form,[x[0]]:Number(e.target.value)})}/></label>))}
<select style={inp} value={form.recommendation} onChange={(e)=>setForm({...form,recommendation:e.target.value})}><option value="selected">Selected</option><option value="rejected">Rejected</option><option value="on_hold">On Hold</option></select>
<input style={inp} placeholder="Comments" value={form.comments} onChange={(e)=>setForm({...form,comments:e.target.value})}/>
</div><div style={{marginTop:10}}><button type="button" style={btnP} onClick={save}>Submit</button></div></div>)}
{st==='loading'&&<Loading/>}{st==='err'&&<Err text={err} onRetry={load}/>}
{st==='ok'&&(f==='pending'
?((d.pending||[]).length===0?<Empty text="No pending evaluations."/>:<div style={{...card,overflowX:'auto',padding:0}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:760}}><thead><tr><th style={th}>Candidate</th><th style={th}>Company</th><th style={th}>Round</th><th style={th}>Date</th><th style={th}>Action</th></tr></thead><tbody>{(d.pending||[]).map((p)=>(<tr key={p._id}><td style={td}><b>{p.trainee?.name||''}</b><div style={{fontSize:12,color:'#64748B'}}>{p.trainee?.email||''}</div></td><td style={td}>{p.company?.name||'—'}</td><td style={td}>{p.round||p.type||''}</td><td style={td}>{fmtDT(p.scheduledAt)}</td><td style={td}><button type="button" style={btnG} onClick={()=>setForm({...form,interview:p._id})}>Review</button></td></tr>))}</tbody></table></div>)
:((d.evaluations||[]).length===0?<Empty text="No evaluations found."/>:<div style={{...card,overflowX:'auto',padding:0}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:820}}><thead><tr><th style={th}>Candidate</th><th style={th}>Interview</th><th style={th}>Score</th><th style={th}>Recommendation</th><th style={th}>Comments</th></tr></thead><tbody>{(d.evaluations||[]).map((e)=>(<tr key={e._id}><td style={td}><b>{e.candidate?.name||''}</b></td><td style={td}>{e.interview?.round||''} · {fmtDT(e.interview?.scheduledAt)}</td><td style={td}>{e.overallScore}</td><td style={td}><Badge v={e.recommendation}/></td><td style={td}>{e.comments||'—'}</td></tr>))}</tbody></table></div>))}
</div>);}
