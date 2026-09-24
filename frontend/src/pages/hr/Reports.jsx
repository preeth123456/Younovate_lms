// HR Reports - real summary + CSV export of filtered data
import React,{useCallback,useEffect,useState} from 'react';
import {card,h2,sub,page,inp,btnG,Loading,Err} from '../../components/hr/hrUi';
import {hrGet,hrExport} from '../../features/hr/hrApi';
const Row=({k,v})=>(<div style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid #F1F5F9',fontSize:13}}><span style={{color:'#475569'}}>{k}</span><b>{v}</b></div>);
export default function HRReports(){
const [from,setFrom]=useState('');const [to,setTo]=useState('');const [company,setCompany]=useState('');
const [cos,setCos]=useState([]);const [d,setD]=useState(null);const [st,setSt]=useState('loading');const [err,setErr]=useState('');
const load=useCallback(async()=>{setSt('loading');try{const r=await hrGet('/reports/summary',{from:from||undefined,to:to||undefined,company:company||undefined});setD(r);setSt('ok');}catch(e){setErr(e.response?.data?.message||'Unable to load.');setSt('err');}},[from,to,company]);
useEffect(()=>{load();hrGet('/companies',{limit:100}).then((r)=>setCos(r.companies||[])).catch(()=>{});},[load]);
const dl=(kind)=>{hrExport(kind).catch(()=>{});};
return(<div style={page}>
<div style={{marginBottom:14}}><h2 style={h2}>Reports</h2><p style={sub}>Placement analytics from real data</p></div>
<div style={{...card,marginBottom:12,display:'flex',gap:8,flexWrap:'wrap'}}><input style={inp} type="date" value={from} onChange={(e)=>setFrom(e.target.value)}/><input style={inp} type="date" value={to} onChange={(e)=>setTo(e.target.value)}/><select style={inp} value={company} onChange={(e)=>setCompany(e.target.value)}><option value="">All companies</option>{cos.map((c)=>(<option key={c._id} value={c._id}>{c.name}</option>))}</select><button type="button" style={btnG} onClick={load}>Apply</button></div>
{st==='loading'&&<Loading/>}{st==='err'&&<Err text={err} onRetry={load}/>}
{st==='ok'&&(<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:12}}>
<div style={card}><h3>Candidates</h3>{Object.entries(d.candidates||{}).map(([k,v])=><Row key={k} k={k} v={v}/>)}{Object.keys(d.candidates||{}).length===0&&<p style={sub}>No data.</p>}<button type="button" style={btnG} onClick={()=>dl('candidates')}>Export CSV</button></div>
<div style={card}><h3>Interviews</h3>{Object.entries(d.interviews||{}).map(([k,v])=><Row key={k} k={k} v={v}/>)}{Object.keys(d.interviews||{}).length===0&&<p style={sub}>No data.</p>}<button type="button" style={btnG} onClick={()=>dl('interviews')}>Export CSV</button></div>
<div style={card}><h3>Offers</h3>{Object.entries(d.offers||{}).map(([k,v])=><Row key={k} k={k} v={v}/>)}{Object.keys(d.offers||{}).length===0&&<p style={sub}>No data.</p>}<button type="button" style={btnG} onClick={()=>dl('offers')}>Export CSV</button></div>
<div style={card}><h3>Placements</h3>{Object.entries(d.placements||{}).map(([k,v])=><Row key={k} k={k} v={v}/>)}{Object.keys(d.placements||{}).length===0&&<p style={sub}>No data.</p>}<button type="button" style={btnG} onClick={()=>dl('placements')}>Export CSV</button></div>
<div style={card}><h3>Company-wise Placements</h3>{(d.companyWise||[]).map((c)=><Row key={c._id||c.company} k={c.company||'—'} v={c.placed}/>)}{(d.companyWise||[]).length===0&&<p style={sub}>No data.</p>}</div>
</div>)}
</div>);}
