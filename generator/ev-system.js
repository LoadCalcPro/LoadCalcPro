(function(){
'use strict';

const KEY='loadcalcpro_generator_ev_system_v1';
let rows=[{qty:'',va:''}],energyManaged=false,managedMaximum='',generatorManaged=false,ready=false;
const $=id=>document.getElementById(id);
const number=value=>{const n=Number(value);return Number.isFinite(n)&&n>0?n:0};
const quantity=value=>Math.max(0,Math.floor(number(value)));
const format=value=>number(value)?Math.round(number(value)).toLocaleString('en-US'):'';

function saved(){
  try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){return null}
}

function load(){
  const data=saved();
  if(data&&Array.isArray(data.rows)&&data.rows.length){
    rows=data.rows.map(row=>({qty:row&&row.qty!==undefined?String(row.qty):'',va:row&&row.va!==undefined?String(row.va):''}));
    energyManaged=data.energyManaged===true;
    managedMaximum=data.managedMaximum!==undefined?String(data.managedMaximum):'';
    generatorManaged=data.generatorManaged===true;
  }else{
    const oldQty=$('q43')?$('q43').value:'';
    const oldVA=$('v43')?$('v43').value:'';
    rows=[{qty:oldQty,va:oldVA}];
    if(typeof managedQuantities==='object'&&managedQuantities)generatorManaged=Number(managedQuantities[43]||0)>0;
  }
  if(typeof managedQuantities==='object'&&managedQuantities){managedQuantities[43]=0;if(typeof saveManagedQuantities==='function')saveManagedQuantities()}
}

function save(){
  try{localStorage.setItem(KEY,JSON.stringify({rows,energyManaged,managedMaximum,generatorManaged}))}catch(e){}
}

function rowMarkup(row,index){
  const suffix=index===0?'':String(index+1),qtyId=index===0?'q43':'evQty'+index,vaId=index===0?'v43':'evVa'+index;
  return '<div class="load-row ev-charger-row" data-ev-index="'+index+'">'+
    '<div class="load-name continuous-load-name"><div class="ev-charger-name">EV Charger'+(suffix?' '+suffix:'')+'</div><small>7,200 VA minimum or nameplate</small></div>'+
    '<div class="load-inputs"><div class="input-block"><label for="'+qtyId+'">Qty</label><input id="'+qtyId+'" data-ev-key="qty" type="number" min="0" step="1" inputmode="numeric" placeholder="Qty" value="'+escapeValue(row.qty)+'"></div>'+
    '<div class="input-block"><label for="'+vaId+'">Nameplate VA</label><input id="'+vaId+'" data-ev-key="va" type="number" min="0" step="any" inputmode="decimal" placeholder="Nameplate VA" value="'+escapeValue(row.va)+'"></div></div>'+
    '<div class="row-output"><div class="output-box"><div class="output-label">Connected VA</div><div class="output-value" data-ev-connected></div></div></div></div>';
}

function escapeValue(value){return String(value===undefined?'':value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}

function activeRows(){return rows.map((row,index)=>({index,quantity:quantity(row.qty),va:number(row.va)})).filter(row=>row.quantity>0||row.va>0)}
function completeRows(){return activeRows().filter(row=>row.quantity>0&&row.va>0)}
function hasPartial(){return activeRows().some(row=>(row.quantity>0)!==(row.va>0))}
function controlsEnabled(){return completeRows().length>0&&!hasPartial()}

function syncRowsFromDOM(){
  if(!ready)return;
  document.querySelectorAll('#evChargerRows [data-ev-index]').forEach(holder=>{
    const index=Number(holder.dataset.evIndex),qtyInput=holder.querySelector('[data-ev-key="qty"]'),vaInput=holder.querySelector('[data-ev-key="va"]');
    if(rows[index]){rows[index].qty=qtyInput?qtyInput.value:rows[index].qty;rows[index].va=vaInput?vaInput.value:rows[index].va}
  });
}

function calculateModel(sourceRows,isEnergyManaged,maximumValue,isGeneratorManaged){
  const completed=(sourceRows||[]).map((row,index)=>({index,quantity:quantity(row.qty),va:number(row.va)})).filter(row=>row.quantity>0&&row.va>0).map(row=>({...row,connected:row.quantity*Math.max(7200,row.va)}));
  const connected=completed.reduce((sum,row)=>sum+row.connected,0);
  const entered=(sourceRows||[]).some(row=>number(row.qty)>0||number(row.va)>0);
  const partial=(sourceRows||[]).some(row=>(quantity(row.qty)>0)!==(number(row.va)>0));
  const enabled=completed.length>0&&!partial;
  const managed=enabled&&isEnergyManaged===true;
  const maximum=number(maximumValue);
  const service=managed&&maximum>0?maximum:connected;
  const generatorIsManaged=enabled&&isGeneratorManaged===true;
  return {rows:completed,connected,energyManaged:managed,managedMaximum:maximum,service,generatorManaged:generatorIsManaged,generator:generatorIsManaged?0:service,complete:enabled,partial,entered};
}

function state(){
  syncRowsFromDOM();
  return calculateModel(rows,energyManaged,managedMaximum,generatorManaged);
}

function renderRows(){
  const container=$('evChargerRows');
  if(!container)return;
  container.innerHTML=rows.map(rowMarkup).join('');
  container.querySelectorAll('[data-ev-key]').forEach(input=>input.addEventListener('input',event=>{
    const holder=event.target.closest('[data-ev-index]'),index=Number(holder.dataset.evIndex),key=event.target.dataset.evKey;
    if(key==='qty'&&event.target.value!==''&&Number(event.target.value)<=0)event.target.value='';
    rows[index][key]=event.target.value;
    update();
  }));
}

function messages(forPrint){
  const current=state(),errors=[];
  if(current.partial)errors.push('Complete quantity and VA for every entered EV charger.');
  if(!current.energyManaged)current.rows.filter(row=>row.va<7200).forEach(row=>errors.push('EV Charger'+(row.index?' '+(row.index+1):'')+' load must be at least 7,200 VA unless EV Energy Management is selected.'));
  if(current.energyManaged&&!current.managedMaximum)errors.push('Enter the combined EV Energy Management maximum VA.');
  return forPrint?errors:errors;
}

function renderControls(){
  const enabled=controlsEnabled(),energy=$('evEnergyManaged'),generator=$('evGeneratorManaged');
  if(!enabled){energyManaged=false;generatorManaged=false}
  energy.disabled=!enabled;energy.checked=energyManaged;
  generator.disabled=!enabled;generator.checked=generatorManaged;
  $('evManagedMaximumField').hidden=!energyManaged;
  $('evManagedMaximum').disabled=!energyManaged;
  $('evManagedMaximum').value=managedMaximum;
  $('evEnergyHelp').textContent=enabled?'Check this box when all entered EV chargers share one energy-management system.':'Enter an EV charger quantity and nameplate VA to enable energy management.';
}

function renderValues(){
  const current=state();
  document.querySelectorAll('[data-ev-index]').forEach(holder=>{
    const index=Number(holder.dataset.evIndex),row=rows[index],output=holder.querySelector('[data-ev-connected]');
    if(output)output.textContent=quantity(row.qty)&&number(row.va)?format(quantity(row.qty)*Math.max(7200,number(row.va))):'';
  });
  if($('evConnectedTotal'))$('evConnectedTotal').textContent=format(current.connected);
  if($('e43'))$('e43').textContent=format(current.service);
  if($('f43'))$('f43').textContent=format(current.generator);
  const warning=$('evValidation'),errors=messages(false);
  warning.hidden=!errors.length;
  warning.innerHTML=errors.map(error=>'<div>'+escapeValue(error)+'</div>').join('');
}

function update(runCalculation=true){
  renderControls();
  renderValues();
  save();
  if(runCalculation&&ready&&typeof window.calculate==='function')window.calculate();
}

function addRow(){rows.push({qty:'',va:''});renderRows();update()}
function removeRow(){
  if(rows.length<=1)return;
  const last=rows[rows.length-1];
  if((number(last.qty)||number(last.va))&&!window.confirm('Remove the last EV charger and its entered values?'))return;
  rows.pop();renderRows();update();
}

function init(){
  if(!$('evSystem'))return;
  load();renderRows();
  $('addEvCharger').addEventListener('click',addRow);
  $('removeEvCharger').addEventListener('click',removeRow);
  $('evEnergyManaged').addEventListener('change',event=>{energyManaged=event.target.checked;update()});
  $('evManagedMaximum').addEventListener('input',event=>{managedMaximum=event.target.value;update()});
  $('evGeneratorManaged').addEventListener('change',event=>{generatorManaged=event.target.checked;update()});
  ready=true;update();
}

const previousContinuous=window.continuousLoadCalculation;
window.continuousLoadCalculation=function(){
  const ev=state();
  const continuous100Service=typeof rowVA==='function'?rowVA(47):0;
  const continuous100Generator=typeof generatorRowValue==='function'?generatorRowValue(47,continuous100Service):continuous100Service;
  const additionalContinuousService=(typeof rowVA==='function'?rowVA(42):0)*1.25;
  const additionalContinuousGenerator=typeof generatorRowValue==='function'?generatorRowValue(42,additionalContinuousService):additionalContinuousService;
  if(typeof setOutput==='function'){
    setOutput('e43',ev.service);setOutput('f43',ev.generator);
    setOutput('e47',continuous100Service);setOutput('f47',continuous100Generator);
    setOutput('e42',additionalContinuousService);setOutput('f42',additionalContinuousGenerator);
  }
  return {service:ev.service+continuous100Service+additionalContinuousService,generator:ev.generator+continuous100Generator+additionalContinuousGenerator,evService:ev.service,evGenerator:ev.generator,continuous100Service,continuous100Generator,additionalService:additionalContinuousService,additionalGenerator:additionalContinuousGenerator};
};

const previousManagedCount=window.getCompleteManagedLoadCount;
window.getCompleteManagedLoadCount=function(){
  const base=typeof previousManagedCount==='function'?Number(previousManagedCount())||0:0;
  const ev=state();
  return base+(ev.generatorManaged?ev.rows.reduce((sum,row)=>sum+row.quantity,0):0);
};
window.applicableManagedLoadCount=window.getCompleteManagedLoadCount;
window.getEVSystemState=state;
window.calculateEVSystemModel=calculateModel;
window.validateEVSystemForPrint=function(){
  const errors=messages(true);
  if(!errors.length)return true;
  const warning=$('evValidation');warning.hidden=false;warning.innerHTML=errors.map(error=>'<div>'+escapeValue(error)+'</div>').join('');warning.scrollIntoView({behavior:'smooth',block:'center'});return false;
};
window.resetEVSystem=function(){
  rows=[{qty:'',va:''}];energyManaged=false;managedMaximum='';generatorManaged=false;
  try{localStorage.removeItem(KEY)}catch(e){}
  if(ready){renderRows();update(false)}
};
window.refreshEVSystem=function(){
  if(!ready)return;
  syncRowsFromDOM();renderControls();renderValues();save();
};

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
