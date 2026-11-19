'use client';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { Fragment, useEffect, useState } from 'react';
import { reportStatus } from '../lib/validation.mjs';
function Move({target}) { const map=useMap(); useEffect(()=>{if(target)map.flyTo([target.lat,target.lng],15,{duration:1})},[target,map]); return null; }
function MapCountry({onCenterChange}) {
 const map=useMapEvents({moveend(){const center=map.getCenter();onCenterChange({lat:center.lat,lng:((center.lng+180)%360+360)%360-180});}});
 useEffect(()=>{const center=map.getCenter();onCenterChange({lat:center.lat,lng:center.lng});},[map,onCenterChange]);
 return null;
}
function PickLocation({active,onPick}) {
 const map=useMapEvents({click(event){if(active)onPick({lat:event.latlng.lat,lng:event.latlng.lng});}});
 useEffect(()=>{map.getContainer().classList.toggle('map-picking',active);return()=>map.getContainer().classList.remove('map-picking');},[map,active]);
 return null;
}
// Reuse icons so React updates do not replace marker HTML or restart its pulse.
const markerIcons = new globalThis.Map();
function icon(status,category,confirmed=true){const key=`${status}:${category}:${confirmed}`;if(markerIcons.has(key))return markerIcons.get(key);const person=['crime','antisocial'].includes(category)?'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="3"/><path d="M6 19c0-4 2-6 6-6s6 2 6 6"/></svg>':'';const result=L.divIcon({className:'custom-marker',html:`<span class="marker ${status} ${person?'person-marker':''} ${category==='degradation'?'degradation-marker':''} ${confirmed?'':'unconfirmed-marker'}">${person}</span>`,iconSize:[32,32],iconAnchor:[16,16]});markerIcons.set(key,result);return result;}
const userLocationIcon = L.divIcon({className:'user-location-icon',html:'<span class="user-location-dot"></span>',iconSize:[24,24],iconAnchor:[12,12]});
function ExactAddress({report,labels}) {
 const [address,setAddress]=useState(null), [loading,setLoading]=useState(true);
 useEffect(()=>{const controller=new AbortController();fetch(`/api/reverse?lat=${encodeURIComponent(report.lat)}&lng=${encodeURIComponent(report.lng)}`,{signal:controller.signal}).then(response=>{if(!response.ok)throw Error();return response.json();}).then(data=>setAddress(data.address)).catch(()=>{}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[report.lat,report.lng]);
 return <small>{labels.exactLocation}<br/>{labels.exactAddress}: {loading?labels.addressLoading:address||labels.addressUnavailable}</small>;
}
function ReportPopup({report,locale,labels,onConfirmed}) {
 const [state,setState]=useState('idle');
 async function confirm(){setState('busy');try{const response=await fetch(`/api/reports/${report.id}/confirm`,{method:'POST'});if(!response.ok){setState(response.status===409?'unavailable':'error');return;}setState('done');await onConfirmed();}catch{setState('error');}}
 return <><strong>{labels.categories[report.category] || labels.categories.theft}</strong><br/>{new Date(report.occurredAt).toLocaleString(locale,{dateStyle:'long',timeStyle:'short'})}<br/>{report.locationPrecision==='exact'?<ExactAddress report={report} labels={labels}/>:<small>{labels.approximate}</small>}{report.notes&&<><br/><strong>{labels.notes}:</strong> <span className="report-notes">{report.notes}</span></>}<div className="confirmation-summary"><strong>{labels.confirmationCount(report.confirmations)}</strong><span>{report.confirmations >= 2 ? labels.communityConfirmed : labels.unverified}</span></div>{report.sameNetwork?<p className="confirmation-message">{labels.sameNetwork}</p>:report.alreadyConfirmed||state==='done'?<p className="confirmation-message">{state==='done'?labels.confirmed:labels.alreadyConfirmed}</p>:<button className="confirm-report" onClick={confirm} disabled={state==='busy'}>{labels.confirm}</button>}{state==='unavailable'&&<p role="alert">{labels.confirmUnavailable}</p>}{state==='error'&&<p role="alert">{labels.confirmError}</p>}</>;
}
export default function Map({reports,now,selected,userLocation,fly,locale,labels,picking,onPick,onConfirmed,onCenterChange}) {
 const groups = new globalThis.Map();
 for (const report of reports) {
  const key = `${report.lat},${report.lng}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(report);
 }
 return <MapContainer center={[45.4642,9.1900]} zoom={12} zoomControl={false} className="map" scrollWheelZoom><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"/><ZoomControl position="bottomright"/><Move target={fly}/><MapCountry onCenterChange={onCenterChange}/><PickLocation active={picking} onPick={onPick}/>{Array.from(groups,([key,items])=>{const r=items.find(item=>item.category!=='degradation') || items[0];return <Fragment key={key}>{items.some(item=>item.category==='degradation')&&<Circle center={[r.lat,r.lng]} radius={150} interactive={false} pathOptions={{color:'#9b2ee8',fillColor:'#9b2ee8',fillOpacity:0.09,weight:2}}/>}{items.some(item=>item.locationPrecision!=='exact')&&<Circle center={[r.lat,r.lng]} radius={150} interactive={false} pathOptions={{color:'#60796b',fillColor:'#60796b',fillOpacity:0.09,weight:1}}/>}<Marker position={[r.lat,r.lng]} interactive={!picking} icon={icon(reportStatus(r.occurredAt,now),r.category,items.some(item=>item.category===r.category&&item.confirmations>=2))}><Popup>{items.map((report,index)=><div key={report.id}>{index>0&&<hr/>}<ReportPopup report={report} locale={locale} labels={labels} onConfirmed={onConfirmed}/></div>)}</Popup></Marker></Fragment>})}{userLocation && <Marker position={[userLocation.lat,userLocation.lng]} interactive={false} icon={userLocationIcon}/>}{selected && <Marker position={[selected.lat,selected.lng]} interactive={false} icon={icon('selected-marker')}/>}</MapContainer>}
