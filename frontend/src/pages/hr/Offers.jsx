// HR Offers - lifecycle draft/approved/released/accepted/declined/expired
import React,{useCallback,useEffect,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {card,h2,sub,page,inp,btnP,btnG,th,td,Badge,Empty,Loading,Err,fmtD} from '../../components/hr/hrUi';
import {hrGet,hrPost,hrPatch} from '../../features/hr/hrApi';
export default function HROffers(){
const [sp]=useSearchParams();
const [status,setStatus]=useState('');const [search,setSearch]=useState(sp.get('search')||'');const [deb,setDeb]=useState(sp.get('search')||'');
const [d,setD]=useState(null);const [st,setSt]=useState('loading');const [err,setErr]=useState('');
const [show,setShow]=useState(false);const [cands,setCands]=useState([]);const [cos,setCos]=useState([]);
const [form,setForm]=useState({candidate:'',company:'',role:'',ctc:'',location:'',offerDate:'',joiningDate:'',status:'released'});
useEffect(()=>{const t=setTimeout(()=>setDeb(search),350);return()=>clearTimeout(t);},[search]);
const load=useCallback(async()=>{setSt('loading');try{const r=await hrGet('/offers',{status,search:deb,limit:25});setD(r);setSt('ok');const c=await hrGet('/candidates',{tab:'selected',limit:100});setCands(c.candidates||[]);const cc=await hrGet('/companies',{limit:100});setCos(cc.companies||[]);}catch(e){setErr(e.response?.data?.message||'Unable to load.');setSt('err');}},[status,deb]);
useEffect(()=>{load();},[load]);
const save=async()=>{if(!form.candidate||!form.company)return alert('Candidate + company required');try{await hrPost('/offers',form);setShow(false);load();}catch(e){alert(e.response?.data?.message||'Failed');}};
const mv=async(id,s)=>{try{await hrPatch(`/offers/${id}/status`,{status:s});load();}catch(e){alert(e.response?.data?.message||'Failed');}};
const next={draft:['approved','expired'],approved:['released','expired'],released:['accepted','declined','expired'],accepted:[],declined:[],expired:[]};
return(<div style={page}>
<div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap',marginBottom:14}}><div><h2 style={h2}>Offers</h2><p style={sub}>Offer lifecycle after selection</p></div><button type="button" style={btnP} onClick={()=>setShow(true)}>+ Create Offer</button></div>
<div style={{...card,marginBottom:12,display:'flex',gap:8,flexWrap:'wrap'}}><input style={{...inp,flex:'1 1 220px'}} placeholder="Search candidate…" value={search} onChange={(e)=>setSearch(e.target.value)}/><select style={inp} value={status} onChange={(e)=>setStatus(e.target.value)}><option value="">All status</option><option value="draft">Draft</option><option value="approved">Approved</option><option value="released">Released</option><option value="accepted">Accepted</option><option value="declined">Declined</option><option value="expired">Expired</option></select></div>
{show&&(<div style={{...card,marginBottom:12}}><h3 style={{marginTop:0}}>New Offer (selected candidates only)</h3><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:10}}>
<select style={inp} value={form.candidate} onChange={(e)=>setForm({...form,candidate:e.target.value})}><option value="">Candidate *</option>{cands.map((c)=>(<option key={c._id} value={c._id}>{c.name}</option>))}</select>
<select style={inp} value={form.company} onChange={(e)=>setForm({...form,company:e.target.value})}><option value="">Company *</option>{cos.map((c)=>(<option key={c._id} value={c._id}>{c.name}</option>))}</select>
<input style={inp} placeholder="Role" value={form.role} onChange={(e)=>setForm({...form,role:e.target.value})}/>
<input style={inp} placeholder="CTC" value={form.ctc} onChange={(e)=>setForm({...form,ctc:e.target.value})}/>
<input style={inp} placeholder="Location" value={form.location} onChange={(e)=>setForm({...form,location:e.target.value})}/>
<input style={inp} type="date" value={form.offerDate} onChange={(e)=>setForm({...form,offerDate:e.target.value})}/>
<input style={inp} type="date" value={form.joiningDate} onChange={(e)=>setForm({...form,joiningDate:e.target.value})}/>
</div><div style={{display:'flex',gap:8,marginTop:10}}><button type="button" style={btnP} onClick={save}>Save</button><button type="button" style={btnG} onClick={()=>setShow(false)}>Cancel</button></div></div>)}
{st==='loading'&&<Loading/>}{st==='err'&&<Err text={err} onRetry={load}/>}
{st==='ok'&&((d.offers||[]).length===0?<Empty text="No offers found."/>:<div style={{...card,overflowX:'auto',padding:0}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:880}}><thead><tr><th style={th}>Candidate</th><th style={th}>Company</th><th style={th}>CTC</th><th style={th}>Offer Date</th><th style={th}>Status</th><th style={th}>Actions</th></tr></thead><tbody>{(d.offers||[]).map((o)=>(<tr key={o._id}><td style={td}><b>{o.candidate?.name||''}</b><div style={{fontSize:12,color:'#64748B'}}>{o.role||''}</div></td><td style={td}>{o.company?.name||''}</td><td style={td}>{o.ctc||'—'}</td><td style={td}>{fmtD(o.offerDate)}</td><td style={td}><Badge v={o.status}/></td><td style={td}><div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{(next[o.status]||[]).map((n)=>(<button key={n} type="button" style={btnG} onClick={()=>mv(o._id,n)}>{n}</button>))}</div></td></tr>))}</tbody></table></div>)}
</div>);}
