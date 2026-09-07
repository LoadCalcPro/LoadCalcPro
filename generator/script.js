Warning: truncated output (original token count: 64228)
Total output lines: 17251

"use strict";

function syncLargestMotorSection(){}

function largestMotorCalculation(){
  return {
    service:0,
    generator:0,
    additionalVA:0,
    type:""
  };
}

const STORAGE_KEY =
"loadcalcpro_generator_mobile_nec2023_v1";

const MANAGED_QTY_STORAGE_KEY =
"loadcalcpro_generator_mobile_managed_quantities_v1";

let suppressAutoSave = false;
let restorePromptOpen = false;
let saveStatusTimer = null;

const managedQuantities = readManagedQuantities();

const APPLIANCES = [
  {row:10,label:"Dishwasher"},
  {row:11,label:"Disposal"},
  {row:12,label:"Refrigerator"},
  {row:13,label:"Microwave"},
  {row:14,label:"Hood Fan"},
  {row:15,label:"Freezer"},
  {row:16,label:"Range — Nameplate"},
  {row:17,label:"Wall Oven — Nameplate"},
  {row:18,label:"Cooktop"},
  {row:19,label:"Bath Fan",editable:true},
  {row:20,label:"Wine Cooler",editable:true},
  {row:21,label:"Coffee Machine",editable:true},
  {row:22,label:"Garage Door Opener",editable:true},
  {row:23,label:"Golf Cart Charger",editable:true},
  {row:24,label:"Pool Equipment",editable:true},
  {row:25,label:"Irrigation Pump",editable:true},
  {row:26,label:"Sauna",editable:true},
  {row:27,label:"",editable:true},
  {row:28,label:"",editable:true},
  {row:29,label:"Water Heater"},
  {row:30,label:"Dryer"}
];

const MANAGED_ROWS = [
  10,11,12,13,14,15,16,17,18,19,20,
  21,22,23,24,25,26,27,28,29,30,
  37,38,39,40,41,42,43,47
];

const INPUT_ROWS = [
  5,6,7,
  10,11,12,13,14,15,16,17,18,19,20,
  21,22,23,24,25,26,27,28,29,30,
  37,38,39,40,42,43,47
];

function numberValue(id){
  const el = document.getElementById(id);
  const n = Number(el ? el.value : 0);
  return Number.isFinite(n) ? n : 0;
}

function positiveQuantity(id){
  const n = Math.floor(numberValue(id));
  return n > 0 ? n : 0;
}

function formatted(value){
  const n = Number(value);

  if(!Number.isFinite(n) || n === 0){
    return "";
  }

  return Math.round(n).toLocaleString("en-US");
}

function setOutput(id,value){
  const el = document.getElementById(id);

  if(el){
    el.textContent = formatted(value);
  }
}

function readOutput(id){
  const el = document.getElementById(id);

  if(!el){
    return 0;
  }

  const n = Number(
    String(el.textContent || "")
    .replace(/[^0-9.-]/g,"")
  );

  return Number.isFinite(n) ? n : 0;
}

function readManagedQuantities(){
  try{
    const saved =
      localStorage.getItem(MANAGED_QTY_STORAGE_KEY);

    return saved ? JSON.parse(saved) : {};
  }catch(e){
    return {};
  }
}

function saveManagedQuantities(){
  try{
    localStorage.setItem(
      MANAGED_QTY_STORAGE_KEY,
      JSON.stringify(managedQuantities)
    );
  }catch(e){}
}

function totalQuantity(row){
  return positiveQuantity("q" + row);
}

function managedQuantity(row){
  const total = totalQuantity(row);

  let selected =
    Math.floor(Number(managedQuantities[row] || 0));

  if(!Number.isFinite(selected) || selected < 0){
    selected = 0;
  }

  if(selected > total){
    selected = total;
  }

  managedQuantities[row] = selected;

  return selected;
}

function updateManagedControl(row){
  const check =
    document.getElementById("m" + row);

  const quantityButton =
    document.getElementById("mq" + row);

  if(!check || !quantityButton){
    return;
  }

  let selected = managedQuantity(row);

  const isHVACRow =
    row >= 37 && row <= 40;

  const applicable =
    !isHVACRow ||
    typeof window.isHVACManagedRowApplicable !== "function" ||
    window.isHVACManagedRowApplicable(row);

  if(
    !applicable ||
    totalQuantity(row) < 1 ||
    numberValue("v" + row) <= 0
  ){
    selected = 0;
  }

  check.classList.toggle(
    "checked",
    selected > 0
  );

  check.textContent =
    selected > 0 ? "✓" : "";

  quantityButton.classList.toggle(
    "show",
    selected > 0
  );

  quantityButton.textContent =
    String(selected);

  check.title =
    selected > 0
      ? "Click to remove managed selection"
      : "Click to manage all entered units";

  quantityButton.title =
    "Click to reduce the managed quantity";
}

function toggleManaged(row){
  if(
    row >= 37 &&
    row <= 40 &&
    typeof window.isHVACManagedRowApplicable === "function" &&
    !window.isHVACManagedRowApplicable(row)
  ){
    return;
  }

  const total = totalQuantity(row);
  const selected = managedQuantity(row);

  managedQuantities[row] =
    selected > 0 ? 0 : total;

  saveManagedQuantities();
  updateManagedControl(row);
  calculate();
}

function reduceManagedQuantity(row){
  if(
    row >= 37 &&
    row <= 40 &&
    typeof window.isHVACManagedRowApplicable === "function" &&
    !window.isHVACManagedRowApplicable(row)
  ){
    return;
  }

  const total = totalQuantity(row);

  if(total < 1){
    return;
  }

  let selected =
    managedQuantity(row) - 1;

  if(selected < 0){
    selected = total;
  }

  managedQuantities[row] = selected;

  saveManagedQuantities();
  updateManagedControl(row);
  calculate();
}

function generatorRowValue(row,serviceValue){
  const total = totalQuantity(row);

  if(total < 1){
    return serviceValue;
  }

  const selected = managedQuantity(row);

  return (
    serviceValue *
    Math.max(total - selected,0) /
    total
  );
}

function applianceDescription(row,defaultLabel){
  const input =
    document.getElementById("d" + row);

  if(input){
    return String(input.value || "").trim();
  }

  return defaultLabel || "";
}

function createApplianceRows(){
  const container =
    document.getElementById("applianceRows");

  if(!container){
    return;
  }

  container.innerHTML = "";

  for(const item of APPLIANCES){
    const row =
      document.createElement("div");

    row.className = "load-row";

    const nameArea =
      document.createElement("div");

    nameArea.className = "load-name";

    if(item.editable){
      const description =
        document.createElement("input");

      description.id = "d" + item.row;
      description.type = "text";
      description.className = "descInput";

      description.placeholder =
        item.label || "Enter load description";

      description.value =
        item.label || "";

      description.addEventListener(
        "input",
        function(){
          saveState();
        }
      );

      nameArea.appendChild(description);

    }else{
      nameArea.textContent = item.label;
    }

    const inputs =
      document.createElement("div");

    inputs.className = "load-inputs";

    const qtyBlock =
      document.createElement("div");

    qtyBlock.className = "input-block";

    const qtyLabel =
      document.createElement("label");

    qtyLabel.setAttribute(
      "for",
      "q" + item.row
    );

    qtyLabel.textContent = "Qty";

    const qtyInput =
      document.createElement("input");

    qtyInput.id = "q" + item.row;
    qtyInput.type = "number";
    qtyInput.min = "0";
    qtyInput.step = "1";
    qtyInput.inputMode = "numeric";

    if(item.qty !== undefined){
      qtyInput.value = item.qty;
    }

    qtyInput.addEventListener(
      "input",
      function(){
        const currentTotal =
          totalQuantity(item.row);

        if(
          managedQuantity(item.row) >
          currentTotal
        ){
          managedQuantities[item.row] =
            currentTotal;
        }

        updateManagedControl(item.row);
        calculate();
      }
    );

    qtyBlock.appendChild(qtyLabel);
    qtyBlock.appendChild(qtyInput);

    const vaBlock =
      document.createElement("div");

    vaBlock.className = "input-block";

    const vaLabel =
      document.createElement("label");

    vaLabel.setAttribute(
      "for",
      "v" + item.row
    );

    vaLabel.textContent = "VA";

    const vaInput =
      document.createElement("input");

    vaInput.id = "v" + item.row;
    vaInput.type = "number";
    vaInput.min = "0";
    vaInput.step = "any";
    vaInput.inputMode = "decimal";

    if(item.va !== undefined){
      vaInput.value = item.va;
    }

    vaInput.addEventListener(
      "input",
      calculate
    );

    vaBlock.appendChild(vaLabel);
    vaBlock.appendChild(vaInput);

    inputs.appendChild(qtyBlock);
    inputs.appendChild(vaBlock);

    const outputRow =
      document.createElement("div");

    outputRow.className = "row-output";

    const serviceBox =
      document.createElement("div");

    serviceBox.className = "output-box";

    serviceBox.innerHTML =
      '<div class="output-label">' +
      'Service Load VA' +
      '</div>' +
      '<div id="e' +
      item.row +
      '" class="output-value"></div>';
    const generatorBox =
      document.createElement("div");

    generatorBox.className = "output-box";

    generatorBox.innerHTML =
      '<div class="output-label">' +
      'Generator Load VA' +
      '</div>' +
      '<div id="f' +
      item.row +
      '" class="output-value"></div>';

    outputRow.appendChild(serviceBox);
    outputRow.appendChild(generatorBox);

    const managedRow =
      document.createElement("div");

    managedRow.className = "managed-row";

    const managedLabel =
      document.createElement("div");

    managedLabel.className =
      "managed-label";

    managedLabel.textContent =
      "Managed Load";

    const managedControls =
      document.createElement("div");

    managedControls.className =
      "managed-controls";

    const checkButton =
      document.createElement("button");

    checkButton.id = "m" + item.row;
    checkButton.className =
      "managed-check";
    checkButton.type = "button";

    checkButton.setAttribute(
      "aria-label",
      "Toggle managed load"
    );

    checkButton.addEventListener(
      "click",
      function(){
        toggleManaged(item.row);
      }
    );

    const qtyButton =
      document.createElement("button");

    qtyButton.id = "mq" + item.row;
    qtyButton.className =
      "managed-qty";
    qtyButton.type = "button";
    qtyButton.textContent = "0";

    qtyButton.setAttribute(
      "aria-label",
      "Reduce managed quantity"
    );

    qtyButton.addEventListener(
      "click",
      function(event){
        event.stopPropagation();
        reduceManagedQuantity(item.row);
      }
    );

    managedControls.appendChild(
      checkButton
    );

    managedControls.appendChild(
      qtyButton
    );

    managedRow.appendChild(
      managedLabel
    );

    managedRow.appendChild(
      managedControls
    );

    row.appendChild(nameArea);
    row.appendChild(inputs);
    row.appendChild(outputRow);
    row.appendChild(managedRow);

    container.appendChild(row);
  }
}

function rowVA(row){
  const quantity =
    positiveQuantity("q" + row);

  let va = numberValue("v" + row);

  if(row === 43 && quantity > 0){
    va = Math.max(va,7200);
  }

  return quantity * va;
}

function ensureRequiredLoadWarning(){
  let warning =
    document.getElementById(
      "necRequiredLoadWarning"
    );

  if(warning){
    return warning;
  }

  const q7 =
    document.getElementById("q7");

  const generalCard =
    q7 ? q7.closest(".card") : null;

  const body =
    generalCard
      ? generalCard.querySelector(".card-body")
      : null;

  if(!body){
    return null;
  }

  warning =
    document.createElement("div");

  warning.id =
    "necRequiredLoadWarning";

  warning.className =
    "nec-required-warning";

  body.appendChild(warning);

  return warning;
}

function validateRequiredGeneralLoads(){
  const small =
    positiveQuantity("q6");

  const laundry =
    positiveQuantity("q7");

  const q6 =
    document.getElementById("q6");

  const q7 =
    document.getElementById("q7");

  const warning =
    ensureRequiredLoadWarning();

  const smallValid =
    small >= 2;

  const laundryValid =
    laundry >= 1;

  const valid =
    smallValid && laundryValid;

  if(q6){
    q6.classList.toggle(
      "nec-invalid-input",
      !smallValid
    );
  }

  if(q7){
    q7.classList.toggle(
      "nec-invalid-input",
      !laundryValid
    );
  }

  if(warning){
    const missing = [];

    if(!smallValid){
      missing.push(
        "at least 2 small-appliance circuits"
      );
    }

    if(!laundryValid){
      missing.push(
        "at least 1 laundry circuit"
      );
    }

    warning.textContent =
      valid
        ? ""
        : "Required dwelling loads are incomplete: enter " +
          missing.join(" and ") +
          ".";

    warning.classList.toggle(
      "show",
      !valid
    );
  }

  return {
    valid:valid,
    smallApplianceValid:smallValid,
    laundryValid:laundryValid
  };
}

function showIncompleteResults(){
  for(const id of [
    "serviceAmps",
    "generatorAmps"
  ]){
    const el =
      document.getElementById(id);

    if(el){
      el.textContent =
        "Required loads incomplete";

      el.classList.add(
        "incomplete"
      );
    }
  }
}

function clearIncompleteResultStyle(){
  for(const id of [
    "serviceAmps",
    "generatorAmps"
  ]){
    const el =
      document.getElementById(id);

    if(el){
      el.classList.remove(
        "incomplete"
      );
    }
  }
}

function generalLoadCalculation(){
  const squareFeet =
    numberValue("q5");

  const lighting =
    squareFeet * 3;

  const smallAppliance =
    positiveQuantity("q6") * 1500;

  const laundry =
    positiveQuantity("q7") * 1500;

  setOutput(
    "e5",
    lighting
  );

  setOutput(
    "f5",
    lighting
  );

  setOutput(
    "e6",
    smallAppliance
  );

  setOutput(
    "f6",
    smallAppliance
  );

  setOutput(
    "e7",
    laundry
  );

  setOutput(
    "f7",
    laundry
  );

  const total =
    lighting +
    smallAppliance +
    laundry;

  setOutput(
    "e8",
    total
  );

  setOutput(
    "f8",
    total
  );

  return total;
}

function applianceLoadCalculation(){
  let serviceApplianceTotal = 0;
  let generatorApplianceTotal = 0;

  for(const item of APPLIANCES){
    const serviceValue =
      rowVA(item.row);

    const generatorValue =
      generatorRowValue(
        item.row,
        serviceValue
      );

    setOutput(
      "e" + item.row,
      serviceValue
    );

    setOutput(
      "f" + item.row,
      generatorValue
    );

    serviceApplianceTotal +=
      serviceValue;

    generatorApplianceTotal +=
      generatorValue;
  }

  setOutput(
    "e31",
    serviceApplianceTotal
  );

  setOutput(
    "f31",
    generatorApplianceTotal
  );

  return {
    service:serviceApplianceTotal,
    generator:generatorApplianceTotal
  };
}

function optionalMethodDemand(load){
  const total =
    Math.max(
      Number(load) || 0,
      0
    );

  if(total <= 10000){
    return total;
  }

  return (
    10000 +
    ((total - 10000) * 0.40)
  );
}

function combinedDemandCalculation(
  generalLoad,
  applianceLoads
){
  const serviceCombined =
    generalLoad +
    applianceLoads.service;

  const generatorCombined =
    generalLoad +
    applianceLoads.generator;

  const serviceAfterDemand =
    optionalMethodDemand(
      serviceCombined
    );

  const generatorAfterDemand =
    optionalMethodDemand(
      generatorCombined
    );

  setOutput(
    "e35",
    serviceAfterDemand
  );

  setOutput(
    "f35",
    generatorAfterDemand
  );

  return {
    service:serviceAfterDemand,
    generator:generatorAfterDemand
  };
}

function calculateHeatingDemand(
  firstHeatingLoad,
  secondHeatingLoad,
  firstQuantity,
  secondQuantity
){
  const totalHeating =
    firstHeatingLoad +
    secondHeatingLoad;

  const totalHeatingUnits =
    firstQuantity +
    secondQuantity;

  if(totalHeatingUnits >= 4){
    return totalHeating * 0.40;
  }

  return totalHeating;
}

function hvacLoadCalculation(){
  const ac1Service =
    rowVA(37);

  const heat1Service =
    rowVA(38);

  const ac2Service =
    rowVA(39);

  const heat2Service =
    rowVA(40);

  const ac1Generator =
    generatorRowValue(
      37,
      ac1Service
    );

  const heat1Generator =
    generatorRowValue(
      38,
      heat1Service
    );

  const ac2Generator =
    generatorRowValue(
      39,
      ac2Service
    );

  const heat2Generator =
    generatorRowValue(
      40,
      heat2Service
    );

  setOutput(
    "e37",
    ac1Service
  );

  setOutput(
    "f37",
    ac1Generator
  );

  setOutput(
    "e38",
    heat1Service
  );

  setOutput(
    "f38",
    heat1Generator
  );

  setOutput(
    "e39",
    ac2Service
  );

  setOutput(
    "f39",
    ac2Generator
  );

  setOutput(
    "e40",
    heat2Service
  );

  setOutput(
    "f40",
    heat2Generator
  );

  const serviceAC =
    ac1Service +
    ac2Service;

  const generatorAC =
    ac1Generator +
    ac2Generator;

  const serviceHeating =
    calculateHeatingDemand(
      heat1Service,
      heat2Service,
      positiveQuantity("q38"),
      positiveQuantity("q40")
    );

  const generatorHeatingUnits =
    Math.max(
      positiveQuantity("q38") -
      managedQuantity(38),
      0
    ) +
    Math.max(
      positiveQuantity("q40") -
      managedQuantity(40),
      0
    );

  const generatorHeatingTotal =
    heat1Generator +
    heat2Generator;

const generatorHeating =
  generatorHeatingUnits >= 4
    ? generatorHeatingTotal * 0.40
    : generatorHeatingTotal;

const serviceHVAC =
  Math.max(
    serviceAC,
    serviceHeating
  );

const generatorHVAC =
  Math.max(
    generatorAC,
    generatorHeating
  );

return {
  service:serviceHVAC,
  generator:generatorHVAC,
  serviceAC:serviceAC,
  generatorAC:generatorAC,
  serviceHeating:serviceHeating,
  generatorHeating:generatorHeating
};
}

function applicableManagedLoadCount(){
  let total = 0;

  for(const row of MANAGED_ROWS){
    if(row === 41) continue;

    const quantity =
      positiveQuantity("q" + row);

    const va =
      numberValue("v" + row);

    if(quantity < 1 || va <= 0){
      continue;
    }

    if(
      row >= 37 &&
      row <= 40 &&
      typeof window.isHVACManagedRowApplicable === "function" &&
      !window.isHVACManagedRowApplicable(row)
    ){
      continue;
    }

    total += Math.min(
      managedQuantity(row),
      quantity
    );
  }

  return total;
}

function continuousLoadCalculation(){
  const evService =
    rowVA(43);

  const evGenerator =
    generatorRowValue(
      43,
      evService
    );

  setOutput("e43",evService);
  setOutput("f43",evGenerator);

  const continuous100Service =
    rowVA(47);

  const continuous100Generator =
    generatorRowValue(
      47,
      continuous100Service
    );

  setOutput(
    "e47",
    continuous100Service
  );

  setOutput(
    "f47",
    continuous100Generator
  );

  const additionalContinuousService =
    rowVA(42) * 1.25;

  const additionalContinuousGenerator =
    generatorRowValue(
      42,
      additionalContinuousService
    );

  setOutput(
    "e42",
    additionalContinuousService
  );

  setOutput(
    "f42",
    additionalContinuousGenerator
  );

  return {
    service:
      evService +
      continuous100Service +
      additionalContinuousService,

    generator:
      evGenerator +
      continuous100Generator +
      additionalContinuousGenerator,

    evService:evService,
    evGenerator:evGenerator,

    continuous100Service:
      continuous100Service,

    continuous100Generator:
      continuous100Generator,

    additionalService:
      additionalContinuousService,

    additionalGenerator:
      additionalContinuousGenerator
  };
}

function serviceVoltage(){
  const voltage =
    numberValue("q46");

  return voltage > 0
    ? voltage
    : 240;
}

function calculateAmps(
  totalVA,
  voltage
){
  if(
    !Number.isFinite(totalVA) ||
    !Number.isFinite(voltage) ||
    voltage <= 0
  ){
    return 0;
  }

  return totalVA / voltage;
}

function displayAmps(
  id,
  amps
){
  const el =
    document.getElementById(id);

  if(!el){
    return;
  }

  const rounded =
    Math.ceil(
      Number(amps) || 0
    );

  el.textContent =
    rounded.toLocaleString("en-US") +
    " A";
}

function calculate(){

  /* V5.41: protect a saved calculation while
     the Continue / Start New prompt is open. */
  if(restorePromptOpen){
    return;
  }

  const generalLoad =
    generalLoadCalculation();

  const applianceLoads =
    applianceLoadCalculation();

  const continuousLoads =
    (
      typeof window.continuousLoadCalculation ===
      "function"
    )
      ? window.continuousLoadCalculation()
      : continuousLoadCalculation();

  const largestMotor =
    largestMotorCalculation();

   /* NEC 2023 Optional Method:
     Demand applies only to
     General + Appliance loads. */

  const demandLoads =
    combinedDemandCalculation(
      generalLoad,
      {
        service:
          applianceLoads.service,

        generator:
          applianceLoads.generator
      }
    );

  const hvacLoads =
    (
      typeof window.hvacLoadCalculation ===
      "function"
    )
      ? window.hvacLoadCalculation()
      : hvacLoadCalculation();

/* HVAC and all Continuous Loads
   are added after demand. */

const serviceHVACContinuous =
  hvacLoads.service +
  continuousLoads.service;

const generatorHVACContinuous =
  hvacLoads.generator +
  continuousLoads.generator;

  setOutput(
    "e44",
    hvacLoads.service
  );

  setOutput(
    "f44",
    hvacLoads.generator
  );

  setOutput(
    "e45",
    continuousLoads.service
  );

  setOutput(
    "f45",
    continuousLoads.generator
  );

  const serviceTotalVA =
    demandLoads.service +
    serviceHVACContinuous;

  const generatorTotalVA =
    demandLoads.generator +
    generatorHVACContinuous;

  const voltage =
    serviceVoltage();

  const serviceCurrent =
    calculateAmps(
      serviceTotalVA,
      voltage
    );

  const generatorCurrent =
    calculateAmps(
      generatorTotalVA,
      voltage
    );

  const requiredLoads =
    validateRequiredGeneralLoads();

  clearIncompleteResultStyle();

  displayAmps(
    "serviceAmps",
    serviceCurrent
  );

  displayAmps(
    "generatorAmps",
    generatorCurrent
  );

  updatePrintRows({
    generalLoad:generalLoad,
    applianceLoads:applianceLoads,
    demandLoads:demandLoads,
    hvacLoads:hvacLoads,
    continuousLoads:continuousLoads,
    largestMotor:largestMotor,
    serviceTotalVA:serviceTotalVA,
    generatorTotalVA:generatorTotalVA,
    serviceCurrent:serviceCurrent,
    generatorCurrent:generatorCurrent,
    voltage:voltage,
    requiredLoadsValid:
      requiredLoads.valid,

    managedLoadCount:
      (
        typeof window.getCompleteManagedLoadCount ===
        "function"
      )
        ? window.getCompleteManagedLoadCount()
        : applicableManagedLoadCount()
  });

  for(const row of MANAGED_ROWS){
    updateManagedControl(row);
  }

  /* Final HVAC refresh keeps the
     controlling rows clickable. */
  [37,38,39,40].forEach(
    function(row){
      updateManagedControl(row);
    }
  );

  if(!suppressAutoSave){
    saveState(false);
  }
}

function connectStaticManagedControls(){

  const staticRows = [
    37,38,39,40,42,43,47
  ];

  for(const row of staticRows){

    const check =
      document.getElementById(
        "m" + row
      );

    const quantity =
      document.getElementById(
        "mq" + row
      );

    if(check){
      check.addEventListener(
        "click",
        function(){
          toggleManaged(row);
        }
      );
    }

    if(quantity){
      quantity.addEventListener(
        "click",
        function(event){
          event.stopPropagation();
          reduceManagedQuantity(row);
        }
      );
    }
  }
}

function connectCalculatorInputs(){

  const ids = [
    "q5","q6","q7",
    "q37","v37",
    "q38","v38",
    "q39","v39",
    "q40","v40",
    "q42","v42",
    "q43","v43",
    "q47","v47",
    "q46"
  ];

  for(const id of ids){

    const el =
      document.getElementById(id);

    if(!el){
      continue;
    }

    const eventName =
      el.tagName === "SELECT"
        ? "change"
        : "input";

    el.addEventListener(
      eventName,
      function(){

        const rowMatch =
          id.match(/^q(\d+)$/);

        if(rowMatch){

          const row =
            Number(rowMatch[1]);

          if(
            MANAGED_ROWS.includes(row)
          ){
            const total =
              totalQuantity(row);

            if(
              managedQuantity(row) >
              total
            ){
              managedQuantities[row] =
                total;
            }

            updateManagedControl(row);
          }
        }

        calculate();
      }
    );
  }

  document
    .querySelectorAll(
      'input[name="largestMotorType"]'
    )
    .forEach(function(el){
      el.addEventListener(
        "change",
        function(){
          calculate();
        }
      );
    });

  const projectIds = [
    "projectName",
    "projectNumber",
    "projectAddress",
    "projectCityState"
  ];

  for(const id of projectIds){

    const el =
      document.getElementById(id);

    if(el){
      el.addEventListener(
        "input",
        function(){
          saveState(false);
        }
      );
    }
  }
}

function calculatorState(){

  const state = {
    savedAt:
      new Date().toISOString(),

    project:{},

    inputs:{},

    descriptions:{},

    managedQuantities:{
      ...managedQuantities
    }
  };

  const projectIds = [
    "projectName",
    "projectNumber",
    "projectAddress",
    "projectCityState"
  ];

  for(const id of projectIds){

    const el =
      document.getElementById(id);

    state.project[id] =
      el ? el.value : "";
  }

  for(const row of INPUT_ROWS){

    const quantity =
      document.getElementById(
        "q" + row
      );

    const va =
      document.getElementById(
        "v" + row
      );

    if(quantity){
      state.inputs[
        "q" + row
      ] = quantity.value;
    }

    if(va){
      state.inputs[
        "v" + row
      ] = va.value;
    }

    const description =
      document.getElementById(
        "d" + row
      );

    if(description){
      state.descriptions[
        "d" + row
      ] = description.value;
    }
  }

  const voltage =
    document.getElementById(
      "q46"
    );

  if(voltage){
    state.inputs.q46 =
      voltage.value;
  }

  const motorCheckbox =
    document.getElementById(
      "includeLargestMotor"
    );

  const motorVA =
    document.getElementById(
      "largestMotorVA"
    );

  const motorType =
    document.querySelector(
      'input[name="largestMotorType"]:checked'
    );

  state.largestMotor = {
    included:
      Boolean(
        motorCheckbox &&
        motorCheckbox.checked
      ),

    va:
      motorVA
        ? motorVA.value
        : "",

    type:
      motorType
        ? motorType.value
        : ""
  };

  return state;
}

function showSaveStatus(text){

  const status =
    document.getElementById(
      "saveStatus"
    );

  if(!status){
    return;
  }

  status.textContent =
    text || "";

  if(saveStatusTimer){
    clearTimeout(
      saveStatusTimer
    );
  }

  if(text){
    saveStatusTimer =
      setTimeout(
        function(){
          status.textContent = "";
        },
        1800
      );
  }
}

function saveState(showMessage){

  /* V5.41:
     never overwrite saved work
     while the restore choice is pending. */

  if(
    suppressAutoSave ||
    restorePromptOpen
  ){
    return;
  }

  try{

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        calculatorState()
      )
    );

    saveManagedQuantities();

    if(showMessage !== false){
      showSaveStatus(
        "Calculation saved"
      );
    }

  }catch(e){

    if(showMessage !== false){
      showSaveStatus(
        "Unable to save calculation"
      );
    }
  }
}

function savedState(){

  try{

    const raw =
      localStorage.getItem(
        STORAGE_KEY
      );

    if(!raw){
      return null;
    }

    const data =
      JSON.parse(raw);

    return (
      data &&
      typeof data === "object"
    )
      ? data
      : null;

  }catch(e){
    return null;
  }
}

function hasSavedCalculation(){

  const data =
    savedState();

  if(!data){
    return false;
  }

  const values = [
    ...Object.values(
      data.project || {}
    ),

    ...Object.values(
      data.inputs || {}
    ),

    ...Object.values(
      data.descriptions || {}
    ),

    ...Object.values(
      data.largestMotor || {}
    )
  ];

  return values.some(
    function(value){
      return String(
        value || ""
      ).trim() !== "";
    }
  );
}

function restoreState(){

  const state =
    savedState();

  if(!state){
    return false;
  }

  suppressAutoSave = true;

  try{

    for(
      const [id,value]
      of Object.entries(
        state.project || {}
      )
    ){

      const el =
        document.getElementById(id);

      if(el){
        const restoredValue =
          value === null ||
          value === undefined
            ? ""
            : value;

        const isQuantity =
          /^q(?:6|7|[89]|[12][0-9]|30|3[7-9]|40|42|43|47)$/.test(id);

        el.value =
          isQuantity &&
          restoredValue !== "" &&
          Number(restoredValue) <= 0
            ? ""
            : restoredValue;
      }
    }

    for(
      const [id,value]
      of Object.entries(
        state.inputs || {}
      )
    ){

      const el =
        document.getElementById(id);

      if(el){
        el.value =
          value === null ||
          value === undefined
            ? ""
            : value;
      }
    }

    for(
      const [id,value]
      of Object.entries(
        state.descriptions || {}
      )
    ){

      const el =
        document.getElementById(id);

      if(el){
        el.value =
          value === null ||
          value === undefined
            ? ""
            : value;
      }
    }

    const savedManaged =
      state.managedQuantities || {};

    for(
      const key
      of Object.keys(
        managedQuantities
      )
    ){
      delete managedQuantities[key];
    }

    for(
      const [row,value]
      of Object.entries(
        savedManaged
      )
    ){

      managedQuantities[row] =
        Math.max(
          Math.floor(
            Number(value) || 0
          ),
          0
        );
    }

    saveManagedQuantities();

  }finally{
    suppressAutoSave = false;
  }

  if(
    typeof window.refreshEVSystem ===
    "function"
  ){
    window.refreshEVSystem();
  }

  calculate();

  showSaveStatus(
    "Previous calculation restored"
  );

  return true;
}

function clearCalculatorFields(){

  suppressAutoSave = true;

  try{

    const projectIds = [
      "projectName",
      "projectNumber",
      "projectAddress",
      "projectCityState"
    ];

    for(const id of projectIds){

      const el =
        document.getElementById(id);

      if(el){
        el.value = "";
      }
    }

    for(const row of INPUT_ROWS){

      const quantity =
        document.getElementById(
          "q" + row
        );

      const va =
        document.getElementById(
          "v" + row
        );

      const description =
        document.getElementById(
          "d" + row
        );

      if(quantity){
        quantity.value = "";
      }

      if(va){
        va.value = "";
      }

      if(description){

        const appliance =
          APPLIANCES.find(
          function(item){
            return item.row === row;
          }
        );

        description.value =
          appliance &&
          appliance.label
            ? appliance.label
            : "";
      }
    }

    const voltage =
      document.getElementById("q46");

    if(voltage){
      voltage.value = "240";
    }

    const motorCheckbox =
      document.getElementById(
        "includeLargestMotor"
      );

    const motorVA =
      document.getElementById(
        "largestMotorVA"
      );

    if(motorCheckbox){
      motorCheckbox.checked = false;
    }

    if(motorVA){
      motorVA.value = "";
    }

    document
      .querySelectorAll(
        'input[name="largestMotorType"]'
      )
      .forEach(function(el){
        el.checked = false;
      });

    syncLargestMotorSection();

    for(
      const key
      of Object.keys(
        managedQuantities
      )
    ){
      delete managedQuantities[key];
    }

    if(
      typeof window.resetHeatingMethodSelection ===
      "function"
    ){
      window.resetHeatingMethodSelection();

    }else{
      try{
        localStorage.removeItem(
          "loadcalcpro_generator_mobile_heating_method_v2"
        );
      }catch(e){}
    }

    localStorage.removeItem(
      STORAGE_KEY
    );

    localStorage.removeItem(
      MANAGED_QTY_STORAGE_KEY
    );

    if(
      typeof window.resetEVSystem ===
      "function"
    ){
      window.resetEVSystem();
    }

  }catch(e){

  }finally{
    suppressAutoSave = false;
  }

  calculate();
}

function clearInputs(){

  clearCalculatorFields();

  showSaveStatus(
    "New calculation started"
  );
}

function startNewCalculationFromButton(){

  const hasData =
    hasSavedCalculation();

  if(
    hasData &&
    !window.confirm(
      "Start a new calculation? " +
      "The saved calculation on this device will be cleared."
    )
  ){
    return;
  }

  clearInputs();
}

function openRestorePrompt(){

  const modal =
    document.getElementById(
      "restoreModal"
    );

  if(!modal){
    return;
  }

  restorePromptOpen = true;

  modal.classList.add(
    "show"
  );
}

function closeRestorePrompt(){

  const modal =
    document.getElementById(
      "restoreModal"
    );

  if(modal){
    modal.classList.remove(
      "show"
    );
  }

  restorePromptOpen = false;
}

function continuePreviousCalculation(){

  closeRestorePrompt();

  restoreState();
}

function startNewFromSavedPrompt(){

  closeRestorePrompt();

  clearInputs();
}

function initializeSavedCalculation(){

  /* V5.41:
     saved work gets first priority;
     later startup calculations are
     blocked until a choice is made. */

  if(hasSavedCalculation()){
    openRestorePrompt();

  }else{
    calculate();
  }
}

function escapeHTML(value){

  return String(
    value || ""
  )
  .replace(/&/g,"&amp;")
  .replace(/</g,"&lt;")
  .replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;")
  .replace(/'/g,"&#039;");
}

function printNumber(value){

  const number =
    Math.round(
      Number(value) || 0
    );

  return number > 0
    ? number.toLocaleString(
        "en-US"
      )
    : "";
}

function printLoadRow(
  description,
  quantity,
  serviceValue,
  generatorValue
){

  if(
    Number(serviceValue) <= 0 &&
    Number(generatorValue) <= 0
  ){
    return "";
  }

  const quantityText =
    quantity === null ||
    quantity === undefined ||
    String(quantity).trim() === ""
      ? ""
      : escapeHTML(
          String(quantity)
        );

  return (
    "<tr>" +
    "<td>" +
    escapeHTML(description) +
    "</td>" +
    "<td class=\"quantity\">" +
    quantityText +
    "</td>" +
    "<td class=\"number\">" +
    printNumber(serviceValue) +
    "</td>" +
    "<td class=\"number\">" +
    printNumber(generatorValue) +
    "</td>" +
    "</tr>"
  );
}

function printHVACMethod(){

  return (
    typeof window.getHVACMethodSummary ===
    "function"
  )
    ? window.getHVACMethodSummary()
    : "Not selected";
}

function printHeatPumpCondition(){

  const validation =
    (
      typeof window.validateHVACMethodSelection ===
      "function"
    )
      ? window.validateHVACMethodSelection()
      : {method:""};

  if(
    validation.method !==
    "heatpump"
  ){
    return "";
  }

  const summary =
    printHVACMethod();

  if(
    summary.indexOf(
      "compressor at 100%"
    ) >= 0
  ){
    return (
      "Compressor and supplemental electric heat " +
      "can operate simultaneously"
    );
  }

  if(
    summary.indexOf(
      "compressor locked out"
    ) >= 0
  ){
    return (
      "Compressor locked out during " +
      "supplemental electric heat"
    );
  }

  return (
    "Operating condition not selected"
  );
}

function updatePrintRows(data){

  const report =
    document.getElementById(
      "printReport"
    );

  if(!report){
    return;
  }

  let html = "";

  html += `
<div class="print-page">

<h1>
<span class="print-title-text">
Generator Optional Method Calculator
</span>

<span class="print-brand">
<span class="bolt">⚡</span>LoadCalcPro<span class="brand-x">X</span>
</span>
</h1>

<div class="print-project">

<div>
<strong>Project:</strong>
${escapeHTML(
  document.getElementById(
    "projectName"
  ).value
)}
</div>

<div>
<strong>Project #:</strong>
${escapeHTML(
  document.getElementById(
    "projectNumber"
  ).value
)}
</div>

<div>
<strong>Address:</strong>
${escapeHTML(
  document.getElementById(
    "projectAddress"
  ).value
)}
</div>

<div>
<strong>City / State:</strong>
${escapeHTML(
  document.getElementById(
    "projectCityState"
  ).value
)}
</div>

</div>

<div class="print-method-details">

<div>
<strong>HVAC Method:</strong>
${escapeHTML(
  printHVACMethod()
)}
</div>

${
  printHeatPumpCondition()
    ? `<div>
<strong>Heat-Pump Operating Condition:</strong>
${escapeHTML(
  printHeatPumpCondition()
)}
</div>`
    : ""
}

<div>
<strong>Service Voltage:</strong>
${printNumber(
  data.voltage
)} V
</div>

<div>
<strong>Service Total:</strong>
${printNumber(
  data.serviceTotalVA
)} VA /
${Math.ceil(
  data.serviceCurrent
)} A
</div>

<div>
<strong>Generator Total:</strong>
${printNumber(
  data.generatorTotalVA
)} VA /
${Math.ceil(
  data.generatorCurrent
)} A
</div>

</div>

<table class="print-table">

<thead>

<tr>
<th>Description</th>
<th>Quantity</th>
<th>Service VA</th>
<th>Generator VA</th>
</tr>

</thead>

<tbody>
`;

  html += printLoadRow(
    "General Lighting",
    numberValue("q5"),
    readOutput("e5"),
    readOutput("f5")
  );

  html += printLoadRow(
    "Small Appliance Circuits",
    positiveQuantity("q6"),
    readOutput("e6"),
    readOutput("f6")
  );

  html += printLoadRow(
    "Laundry Circuit",
    positiveQuantity("q7"),
    readOutput("e7"),
    readOutput("f7")
  );

  for(const item of APPLIANCES){

    const label =
      applianceDescription(
        item.row,
        item.label
      );

    html += printLoadRow(
      label,
      positiveQuantity(
        "q" + item.row
      ),
      readOutput(
        "e" + item.row
      ),
      readOutput(
        "f" + item.row
      )
    );
  }

  html += printLoadRow(
    typeof window.getHVACRowLabel === "function"
      ? window.getHVACRowLabel(37)
      : "Air Conditioning",
    positiveQuantity("q37"),
    readOutput("e37"),
    readOutput("f37")
  );

  html += printLoadRow(
    typeof window.getHVACRowLabel === "function"
      ? window.getHVACRowLabel(38)
      : "Heating",
    positiveQuantity("q38"),
    readOutput("e38"),
    readOutput("f38")
  );

  html += printLoadRow(
    typeof window.getHVACRowLabel === "function"
      ? window.getHVACRowLabel(39)
      : "Air Conditioning",
    positiveQuantity("q39"),
    readOutput("e39"),
    readOutput("f39")
  );

  html += printLoadRow(
    typeof window.getHVACRowLabel === "function"
      ? window.getHVACRowLabel(40)
      : "Heating",
    positiveQuantity("q40"),
    readOutput("e40"),
    readOutput("f40")
  );

  html += printLoadRow(
    "EV Charger",
    positiveQuantity("q43"),
    readOutput("e43"),
    readOutput("f43")
  );

  const continuous100Description =
    String(
      (
        document.getElementById(
          "d47"
        ) || {}
      ).value || ""
    ).trim() ||
    "Additional Continuous Load (100%)";

  html += printLoadRow(
    continuous100Description,
    positiveQuantity("q47"),
    readOutput("e47"),
    readOutput("f47")
  );

  const continuousDescription =
    String(
      (
        document.getElementById(
          "d42"
        ) || {}
      ).value || ""
    ).trim() ||
    "Additional Continuous Load (125%)";

  html += printLoadRow(
    continuousDescription,
    positiveQuantity("q42"),
    readOutput("e42"),
    readOutput("f42")
  );

  if(
    data.largestMotor &&
    data.largestMotor.additionalVA > 0
  ){
    html += printLoadRow(
      data.largestMotor.type +
      " — Additional 25%",
      "",
      data.largestMotor.additionalVA,
      data.largestMotor.additionalVA
    );
  }

  html += `
</tbody>

<tfoot>

<tr>
<td><strong>Demand Load</strong></td>
<td>${printNumber(data.demandLoads.service)}</td>
<td>${printNumber(data.demandLoads.generator)}</td>
</tr>

<tr>
<td><strong>HVAC + Continuous</strong></td>
<td>${printNumber(
  data.hvacLoads.service +
  data.continuousLoads.service +
  (
    data.largestMotor
      ? data.largestMotor.additionalVA
      : 0
  )
)}</td>

<td>${printNumber(
  data.hvacLoads.generator +
  data.continuousLoads.generator +
  (
    data.largestMotor
      ? data.largestMotor.additionalVA
      : 0
  )
)}</td>

</tr>

<tr>

<td>
<strong>Total VA</strong>
</td>

<td>
${printNumber(
  data.serviceTotalVA
)}
</td>

<td>
${printNumber(
  data.generatorTotalVA
)}
</td>

</tr>

<tr>

<td>
<strong>
Calculated Amps
</strong>
</td>

<td>
${Math.ceil(
  data.serviceCurrent
)} A
</td>

<td>
${Math.ceil(
  data.generatorCurrent
)} A
</td>

</tr>

</tfoot>

</table>

<div class="print-code-note">

Calculated using the NEC 2023 optional method
for one-family dwellings.

Final approval remains subject to the authority
having jurisdiction, actual equipment ratings,
and equipment control conditions.

</div>

</div>
`;

  report.innerHTML = html;
}
function organizeInlineLoadControls(){

  const rows =
    document.querySelectorAll(".load-row");

  for(const row of rows){

    const inputs =
      row.querySelector(".load-inputs");

    const managedRow =
      row.querySelector(".managed-row");

    const controls =
      managedRow
        ? managedRow.querySelector(".managed-controls")
        : null;

    if(
      !inputs ||
      !managedRow ||
      !controls
    ){
      continue;
    }

    inputs.classList.add(
      "inline-load-row"
    );

    controls.classList.add(
      "inline-managed-controls"
    );

    inputs.appendChild(controls);

    managedRow.remove();
  }
}

function initializeCalculator(){

  createApplianceRows();

  organizeInlineLoadControls();

  connectStaticManagedControls();

  connectCalculatorInputs();

  syncLargestMotorSection();

  for(const row of MANAGED_ROWS){
    updateManagedControl(row);
  }

  /* Check for saved data before the first calculation.
     Calling calculate() first would auto-save a blank state and overwrite
     the previous calculation before it could be restored. */

  initializeSavedCalculation();
}

document.addEventListener(
  "DOMContentLoaded",
  initializeCalculator
);

window.addEventListener(
  "beforeunload",
  function(){
    saveState(false);
  }
);

function printCalculation(){

  calculate();

  window.print();
}

function goHome(){

  window.location.href =
    "member-dashboard.html";
}

function connectToolbarButtons(){

  const homeButton =
    document.getElementById(
      "homeButton"
    );

  const printButton =
    document.getElementById(
      "printButton"
    );

  const newButton =
    document.getElementById(
      "newCalculationButton"
    );

  if(homeButton){
    homeButton.addEventListener(
      "click",
      goHome
    );
  }

  if(printButton){
    printButton.addEventListener(
      "click",
      function(){
        calculate();
        window.print();
      }
    );
  }

  if(newButton){
    newButton.addEventListener(
      "click",
      startNewCalculationFromButton
    );
  }
}

function connectRestoreButtons(){

  const continueButton =
    document.getElementById(
      "continuePreviousButton"
    );

  const startNewButton =
    document.getElementById(
      "startNewSavedButton"
    );

  if(continueButton){
    continueButton.addEventListener(
      "click",
      continuePreviousCalculation
    );
  }

  if(startNewButton){
    startNewButton.addEventListener(
      "click",
      startNewFromSavedPrompt
    );
  }
}

function preparePrintReport(){

  calculate();

  if(!validateRequiredGeneralLoads().valid){

    const report =
      document.getElementById(
        "printReport"
      );

    if(report){
      report.innerHTML =
        '<div class="print-page">' +
        '<h1>Calculation Incomplete</h1>' +
        '<p>Enter at least 2 small-appliance circuits and 1 laundry circuit before printing.</p>' +
        '</div>';
    }
  }
}

window.addEventListener(
  "beforeprint",
  preparePrintReport
);

document.addEventListener(
  "keydown",
  function(event){

    if(
      event.key === "Escape" &&
      restorePromptOpen
    ){
      closeRestorePrompt();
    }
  }
);

document.addEventListener(
  "DOMContentLoaded",
  function(){

    connectToolbarButtons();

    connectRestoreButtons();
  }
);
(function(){

function applyInlineInputPlaceholders(root){

  const scope =
    root && root.querySelectorAll
      ? root
      : document;

  scope
    .querySelectorAll('.input-block')
    .forEach(function(block){

      const label =
        block.querySelector('label');

      const input =
        block.querySelector(
          'input, select'
        );

      if(!label || !input){
        return;
      }

      const placeholderText =
        label.textContent
          .replace(/\s+/g, ' ')
          .trim();

      if(
        input.tagName === 'INPUT' &&
        placeholderText &&
        !input.getAttribute(
          'placeholder'
        )
      ){
        input.setAttribute(
          'placeholder',
          placeholderText
        );
      }
    });

  const projectPlaceholders = {
    projectName:'Project Name',
    projectNumber:'Project Number',
    projectAddress:'Address',
    projectCityState:'City / State'
  };

  Object
    .keys(projectPlaceholders)
    .forEach(function(id){

      const input =
        document.getElementById(id);

      if(
        input &&
        !input.getAttribute(
          'placeholder'
        )
      ){
        input.setAttribute(
          'placeholder',
          projectPlaceholders[id]
        );
      }
    });
}

function initializeInlinePlaceholders(){

  applyInlineInputPlaceholders(
    document
  );

  const observer =
    new MutationObserver(
      function(mutations){

        mutations.forEach(
          function(mutation){

            mutation.addedNodes.forEach(
              function(node){

                if(node.nodeType === 1){
                  applyInlineInputPlaceholders(
                    node
                  );
                }
              }
            );
          }
        );
      }
    );

  observer.observe(
    document.body,
    {
      childList:true,
      subtree:true
    }
  );
}

if(document.readyState === 'loading'){

  document.addEventListener(
    'DOMContentLoaded',
    initializeInlinePlaceholders
  );

}else{

  initializeInlinePlaceholders();
}

})();

/* Quantity fields return to their Qty placeholder instead of retaining zero. */
(function(){
  'use strict';

  function isQuantityInput(input){
    if(!(input instanceof HTMLInputElement)||input.type!=='number'||input.readOnly){
      return false;
    }
    return /^q(?:6|7|[89]|[12][0-9]|30|3[7-9]|40|42|43|47)$/.test(input.id)||
      input.dataset.v522Field==='qty';
  }

  function clearZeroQuantity(input){
    if(isQuantityInput(input)&&input.value!==''&&Number(input.value)<=0){
      input.value='';
    }
  }

  ['input','change','blur'].forEach(function(eventName){
    document.addEventListener(eventName,function(event){
      clearZeroQuantity(event.target);
    },true);
  });
})();


(function(){

function finishLayout(){

  document
    .querySelectorAll('.load-row')
    .forEach(function(row){

      var inputs =
        row.querySelector(
          '.load-inputs'
        );

      var managed =
        row.querySelector(
          '.managed-controls'
        );

      if(
        inputs &&
        managed &&
        !inputs.contains(managed)
      ){
        managed.classList.add(
          'inline-managed-controls'
        );

        inputs.classList.add(
          'inline-load-row'
        );

        inputs.appendChild(
          managed
        );
      }
    });

  var voltage =
    Array.from(
      document.querySelectorAll(
        'main .card'
      )
    ).find(function(card){

      var h =
        card.querySelector(
          '.card-heading'
        );

      return (
        h &&
        h.textContent
          .replace(/\s+/g,' ')
          .trim() ===
          'Service Voltage'
      );
    });

  var general =
    Array.from(
      document.querySelectorAll(
        'main .card'
      )
    ).find(function(card){

      var h =
        card.querySelector(
          '.card-heading'
        );

      return (
        h &&
        h.textContent
          .replace(/\s+/g,' ')
          .trim() ===
          'General Loads'
      );
    });

  if(
    voltage &&
    general &&
    voltage.nextElementSibling !==
      general
  ){
    general.parentNode.insertBefore(
      voltage,
      general
    );
  }

  if(
    typeof window
      .syncFortyMethodEntryControls ===
      'function'
  ){
    window
      .syncFortyMethodEntryControls();
  }
}

if(document.readyState === 'loading'){

  document.addEventListener(
    'DOMContentLoaded',
    finishLayout
  );

}else{

  finishLayout();
}

new MutationObserver(
  finishLayout
).observe(
  document.documentElement,
  {
    childList:true,
    subtree:true
  }
);

})();


(function(){

'use strict';

const METHOD_KEY =
  'loadcalcpro_generator_mobile_heating_method_v3';

const HP_COMPRESSOR_KEY =
  'loadcalcpro_generator_mobile_hp_compressor_supplemental_v2';

const METHODS = {
  CENTRAL:'central65',
  FORTY:'separate40',
  HEATPUMP:'heatpump'
};

let selectedMethod = '';

let hpCompressorSupplemental = '';

let activeHVACManagedRows =
  new Set();

function value(id){

  const el =
    document.getElementById(id);

  const n =
    el ? Number(el.value) : 0;

  return (
    Number.isFinite(n) &&
    n > 0
  )
    ? n
    : 0;
}

function rowService(row){

  return (
    value('q' + row) *
    value('v' + row)
  );
}

function remainingQty(row){

  return Math.max(
    Math.floor(
      value('q' + row)
    ) -
    managedQuantity(row),
    0
  );
}

function remainingVA(row){

  return (
    remainingQty(row) *
    value('v' + row)
  );
}

function heatQty(){

  return (
    Math.floor(value('q38')) +
    Math.floor(value('q40'))
  );
}

function heatVA(){

  return (
    rowService(38) +
    rowService(40)
  );
}

function findHVACBody(){

  const card =
    Array.from(
      document.querySelectorAll(
        'main .card'
      )
    ).find(function(el){

      const heading =
        el.querySelector(
          '.card-heading'
        );

      return (
        heading &&
        heading.textContent
          .replace(/\s+/g,' ')
          .trim() ===
          'HVAC Loads'
      );
    });

  return card
    ? card.querySelector(
        '.card-body'
      )
    : null;
}

function ensureMethodPanel(){

  let panel =
    document.getElementById(
      'heatingMethodPanel'
    );

  if(panel){

    panel
      .querySelectorAll(
        '.heating-method-choice'
      )
      .forEach(function(button){

        if(
          button.dataset
            .primaryBound === '1'
        ){
          return;
        }

        button.dataset
          .primaryBound = '1';

        button.addEventListener(
          'click',
          function(){

            selectMethod(
              button.dataset.method
            );
          }
        );
      });

    return panel;
  }

  const body =
    findHVACBody();

  if(!body){
    return null;
  }

  const note =
    body.querySelector(
      '.section-note'
    );

  panel =
    document.createElement(
      'div'
    );

  panel.id =
    'heatingMethodPanel';

  panel.className =
    'heating-method-panel';

  panel.innerHTML = `
<div class="heating-method-title">
Select Heating Method
</div>

<button
type="button"
class="heating-method-choice"
data-method="${METHODS.CENTRAL}">
<span class="heating-method-check"></span>
<span class="heating-method-text">
Cooling at 100% / Central Electric Heat at 65%
</span>
</button>

<button
type="button"
class="heating-method-choice"
data-method="${METHODS.FORTY}">
<span class="heating-method-check"></span>
<span class="heating-method-text">
Separately Controlled Electric Heating Systems at 40% — Four or More Required
</span>
</button>

<button
type="button"
class="heating-method-choice"
data-method="${METHODS.HEATPUMP}">
<span class="heating-method-check"></span>
<span class="heating-method-text">
Heat Pump with Supplemental Electric Heat
</span>
</button>

<button
id="multipleHvacSystemsChoice"
type="button"
aria-pressed="false">
<span class="multiple-hvac-check"></span>
<span class="multiple-hvac-text">
Multiple Systems
</span>
</button>

<div
id="heatingMethodRequiredNote"
class="heating-method-required-note">
Select one HVAC method before the final calculation can be completed.
</div>

<div
id="fortyUnitWarning"
class="forty-unit-warning">
The 40% rows are shown for entry and testing, but four or more separately controlled heating units are required for the final calculation.
</div>
`;

  if(note){

    note.insertAdjacentElement(
      'afterend',
      panel
    );

  }else{

    body.insertBefore(
      panel,
      body.firstChild
    );
  }

  panel
    .querySelectorAll(
      '.heating-method-choice'
    )
    .forEach(function(button){

      button.addEventListener(
        'click',
        function(){

          selectMethod(
            button.dataset.method
          );
        }
      );
    });

  return panel;
}

function ensureHeatPumpQuestions(){

  let panel =
    document.getElementById(
      'heatPumpQuestions'
    );

  if(panel){
    return panel;
  }

  const methodPanel =
    ensureMethodPanel();

  if(
    !methodPanel ||
    !methodPanel.parentNode
  ){
    return null;
  }

  panel =
    document.createElement(
      'div'
    );

  panel.id =
    'heatPumpQuestions';

  panel.className =
    'heatpump-questions';

  panel.innerHTML = `
<div class="heatpump-question-title">
Can the heat-pump compressor and supplemental electric heat operate simultaneously?
</div>

<button
type="button"
class="heatpump-answer"
data-hp-value="yes">
<span class="heatpump-answer-check"></span>
<span class="heatpump-answer-text">
Yes — compressor at 100% plus supplemental heat at 65%
</span>
</button>

<button
type="button"
class="heatpump-answer"
data-hp-value="no">
<span class="heatpump-answer-check"></span>
<span class="heatpump-answer-text">
No — controls lock out the compressor during supplemental heat
</span>
</button>

<div
id="heatPumpRequiredNote"
class="heatpump-required-note">
Select one heat-pump operating condition.
</div>
`;

  methodPanel.insertAdjacentElement(
    'afterend',
    panel
  );

  panel
    .querySelectorAll(
      '.heatpump-answer'
    )
    .forEach(function(button){

      button.addEventListener(
        'click',
        function(){

          const value =
            button.dataset.hpValue;

          hpCompressorSupplemental =
            (
              hpCompressorSupplemental ===
              value
            )
              ? ''
              : value;

          saveHeatPumpAnswer();

          updateMethodUI();

          calculate();
        }
      );
    });

  return panel;
}

function create40PercentRow(
  sourceRow,
  index
){

  const id =
    'phoneHeat40Row' + index;

  let row =
    document.getElementById(id);

  if(row){
    return row;
  }

  const sourceInput =
    document.getElementById(
      'q' + sourceRow
    );

  const source =
    sourceInput
      ? sourceInput.closest(
          '.load-row'
        )
      : null;

  if(
    !source ||
    !source.parentNode
  ){
    return null;
  }

  row =
    document.createElement(
      'div'
    );

  row.id = id;

  row.className =
    'load-row';

  row.dataset.sourceHeatingRow =
    String(sourceRow);

  row.innerHTML = `
<div class="load-name">
Heat at 40%
</div>

<div class="load-inputs inline-load-row">

<div class="input-block">
<input
id="q41_${index}"
class="heat40-auto-field"
type="number"
readonly
placeholder="Qty">
</div>

<div class="input-block">
<input
id="v41_${index}"
class="heat40-auto-field"
type="text"
readonly
placeholder="40% VA">
</div>

<div class="inline-managed-controls">

<button
id="m41_${index}"
class="managed-check"
type="button"
aria-label="Manage heating row ${index} at 40 percent">
</button>

<button
id="mq41_${index}"
class="managed-qty"
type="button"
aria-label="Reduce managed heating quantity for row ${index}">
0
</button>

</div>
</div>
`;

  source.insertAdjacentElement(
    'afterend',
    row
  );

  row
    .querySelector(
      '#m41_' + index
    )
    .addEventListener(
      'click',
      function(){

        toggleManaged(
          sourceRow
        );

        sync40PercentManagedControls();
      }
    );

  row
    .querySelector(
      '#mq41_' + index
    )
    .addEventListener(
      'click',
      function(){

        reduceManagedQuantity(
          sourceRow
        );

        sync40PercentManagedControls();
      }
    );

  return row;
}

function ensure40Rows(){

  const row1 =
    create40PercentRow(
      38,
      1
    );

  const row2 =
    create40PercentRow(
      40,
      2
    );

  if(
    !document.getElementById(
      'e41'
    )
  ){

    const holder =
      document.createElement(
        'div'
      );

    holder.innerHTML =
      '<div id="e41" hidden></div>' +
      '<div id="f41" hidden></div>';

    const body =
      findHVACBody();

    if(body){
      body.appendChild(holder);
    }
  }

  return [
    row1,
    row2
  ];
}
function syncFortyMethodEntryControls(){

  const fortySelected =
    selectedMethod === METHODS.FORTY;

  const qualifies =
    heatQty() >= 4;

  [38,40].forEach(function(row){

    const container =
      rowFor(row);

    const inputs =
      container
        ? container.querySelector(
            '.load-inputs'
          )
        : null;

    const check =
      document.getElementById(
        'm' + row
      );

    const qty =
      document.getElementById(
        'mq' + row
      );

    const controls =
      check
        ? check.closest(
            '.inline-managed-controls'
          )
        : null;

    if(inputs){
      inputs.classList.toggle(
        'forty-method-entry-only',
        fortySelected
      );
    }

    if(controls){

      controls.hidden =
        fortySelected;

      controls.style.display =
        fortySelected
          ? 'none'
          : '';

      controls.setAttribute(
        'aria-hidden',
        fortySelected
          ? 'true'
          : 'false'
      );
    }

    if(check){

      check.tabIndex =
        fortySelected
          ? -1
          : 0;

      check.style.pointerEvents =
        fortySelected
          ? 'none'
          : '';
    }

    if(qty){

      qty.tabIndex =
        fortySelected
          ? -1
          : 0;

      qty.style.pointerEvents =
        fortySelected
          ? 'none'
          : '';
    }
  });

  const warning =
    document.getElementById(
      'fortyUnitWarning'
    );

  if(warning){
    warning.classList.toggle(
      'show',
      fortySelected &&
      !qualifies
    );
  }
}

function sync40PercentManagedControls(){

  [
    {source:38,index:1},
    {source:40,index:2}
  ].forEach(function(item){

    const selected =
      managedQuantity(
        item.source
      );

    const total =
      Math.floor(
        value(
          'q' + item.source
        )
      );

    const valid =
      total > 0 &&
      value(
        'v' + item.source
      ) > 0;

    const check =
      document.getElementById(
        'm41_' + item.index
      );

    const qty =
      document.getElementById(
        'mq41_' + item.index
      );

    if(check){

      check.classList.toggle(
        'checked',
        valid &&
        selected > 0
      );

      check.textContent =
        valid &&
        selected > 0
          ? '✓'
          : '';

      check.disabled =
        !valid ||
        selectedMethod !==
          METHODS.FORTY;
    }

    if(qty){

      qty.classList.toggle(
        'show',
        valid &&
        selected > 0
      );

      qty.textContent =
        String(
          valid
            ? selected
            : 0
        );

      qty.disabled =
        !valid ||
        selectedMethod !==
          METHODS.FORTY;
    }
  });
}

function rowFor(row){

  const input =
    document.getElementById(
      'q' + row
    );

  return input
    ? input.closest(
        '.load-row'
      )
    : null;
}

function setLabel(
  row,
  label
){

  const container =
    rowFor(row);

  const name =
    container &&
    container.querySelector(
      '.load-name'
    );

  if(name){
    name.textContent =
      label;
  }
}

function disableHeatingRows(
  disabled
){

  [38,40].forEach(
    function(row){

      const container =
        rowFor(row);

      if(container){
        container.classList.toggle(
          'heating-row-disabled',
          disabled
        );
      }

      [
        'q',
        'v',
        'm',
        'mq'
      ].forEach(
        function(prefix){

          const control =
            document.getElementById(
              prefix + row
            );

          if(control){
            control.disabled =
              disabled;
          }
        }
      );
    }
  );
}

function saveMethod(){

  try{

    localStorage.setItem(
      METHOD_KEY,
      selectedMethod
    );

  }catch(e){}
}

function readMethod(){

  try{

    const method =
      localStorage.getItem(
        METHOD_KEY
      ) || '';

    return Object
      .values(METHODS)
      .includes(method)
        ? method
        : '';

  }catch(e){
    return '';
  }
}

function saveHeatPumpAnswer(){

  try{

    if(
      hpCompressorSupplemental
    ){
      localStorage.setItem(
        HP_COMPRESSOR_KEY,
        hpCompressorSupplemental
      );

    }else{

      localStorage.removeItem(
        HP_COMPRESSOR_KEY
      );
    }

  }catch(e){}
}

function readHeatPumpAnswer(){

  try{

    const answer =
      localStorage.getItem(
        HP_COMPRESSOR_KEY
      ) || '';

    return (
      answer === 'yes' ||
      answer === 'no'
    )
      ? answer
      : '';

  }catch(e){
    return '';
  }
}

function setManagedRowsActive(
  rows
){

  activeHVACManagedRows =
    new Set(rows);

  [37,38,39,40]
    .forEach(function(row){

      const active =
        activeHVACManagedRows
          .has(row) &&
        rowService(row) > 0;

      const check =
        document.getElementById(
          'm' + row
        );

      const qty =
        document.getElementById(
          'mq' + row
        );

      const useFortyRowControl =
        selectedMethod ===
          METHODS.FORTY &&
        (
          row === 38 ||
          row === 40
        );

      if(check){

        check.classList.toggle(
          'managed-control-inactive',
          !active ||
          useFortyRowControl
        );

        check.disabled =
          !active ||
          useFortyRowControl;
      }

      if(qty){

        qty.classList.toggle(
          'managed-control-inactive',
          !active ||
          useFortyRowControl
        );

        qty.disabled =
          !active ||
          useFortyRowControl;
      }
    });

  sync40PercentManagedControls();
}

function updateMethodUI(){

  const panel =
    ensureMethodPanel();

  const rows40 =
    ensure40Rows();

  const hpPanel =
    ensureHeatPumpQuestions();

  if(panel){

    panel
      .querySelectorAll(
        '.heating-method-choice'
      )
      .forEach(function(button){

        const active =
          button.dataset.method ===
          selectedMethod;

        button.classList.toggle(
          'selected',
          active
        );

        button.setAttribute(
          'aria-pressed',
          active
            ? 'true'
            : 'false'
        );

        const check =
          button.querySelector(
            '.heating-method-check'
          );

        if(check){
          check.textContent =
            active
              ? '✓'
              : '';
        }
      });

    const requiredNote =
      document.getElementById(
        'heatingMethodRequiredNote'
      );

    panel.classList.toggle(
      'method-required',
      !selectedMethod
    );

    if(requiredNote){

      requiredNote.classList.toggle(
        'show',
        !selectedMethod
      );
    }
  }

  if(hpPanel){

    hpPanel.classList.toggle(
      'show',
      selectedMethod ===
        METHODS.HEATPUMP
    );

    hpPanel
      .querySelectorAll(
        '.heatpump-answer'
      )
      .forEach(function(button){

        const active =
          button.dataset.hpValue ===
          hpCompressorSupplemental;

        button.classList.toggle(
          'selected',
          active
        );

        button.setAttribute(
          'aria-pressed',
          active
            ? 'true'
            : 'false'
        );

        const check =
          button.querySelector(
            '.heatpump-answer-check'
          );

        if(check){
          check.textContent =
            active
              ? '✓'
              : '';
        }
      });

    const note =
      document.getElementById(
        'heatPumpRequiredNote'
      );

    if(note){

      note.style.display =
        (
          selectedMethod ===
            METHODS.HEATPUMP &&
          !hpCompressorSupplemental
        )
          ? 'block'
          : 'none';
    }
  }

  disableHeatingRows(
    !selectedMethod
  );

  rows40.forEach(
    function(row){

      if(!row){
        return;
      }

      const showFortyRow =
        selectedMethod ===
          METHODS.FORTY;

      row.classList.toggle(
        'show',
        showFortyRow
      );

      row.hidden =
        !showFortyRow;

      row.setAttribute(
        'aria-hidden',
        showFortyRow
          ? 'false'
          : 'true'
      );
    }
  );

  syncFortyMethodEntryControls();

  sync40PercentManagedControls();

  if(
    selectedMethod ===
    METHODS.HEATPUMP
  ){

    setLabel(
      37,
      'Heat Pump Compressor'
    );

    setLabel(
      38,
      'Supplemental Electric Heat'
    );

    setLabel(
      39,
      'Heat Pump Compressor'
    );

    setLabel(
      40,
      'Supplemental Electric Heat'
    );

  }else{

    setLabel(
      37,
      'Air Conditioning'
    );

    setLabel(
      38,
      'Heating'
    );

    setLabel(
      39,
      'Air Conditioning'
    );

    setLabel(
      40,
      'Heating'
    );
  }
}

function selectMethod(
  method
){

  if(
    !Object
      .values(METHODS)
      .includes(method)
  ){
    return;
  }

  selectedMethod =
    selectedMethod === method
      ? ''
      : method;

  /* A managed selection from a different
     HVAC method must not carry over. */

  [37,38,39,40,41]
    .forEach(function(row){

      managedQuantities[row] =
        0;
    });

  if(
    selectedMethod !==
    METHODS.HEATPUMP
  ){

    hpCompressorSupplemental =
      '';

    saveHeatPumpAnswer();
  }

  saveMethod();

  saveManagedQuantities();

  updateMethodUI();

  calculate();
}

window.validateHVACMethodSelection =
  function(){

    const methodSelected =
      Boolean(
        selectedMethod
      );

    const heatPumpReady =
      selectedMethod !==
        METHODS.HEATPUMP ||
      hpCompressorSupplemental ===
        'yes' ||
      hpCompressorSupplemental ===
        'no';

    const fortyPercentReady =
      selectedMethod !==
        METHODS.FORTY ||
      heatQty() >= 4;

    return {
      valid:
        methodSelected &&
        heatPumpReady &&
        fortyPercentReady,

      method:
        selectedMethod,

      methodSelected:
        methodSelected,

      heatPumpReady:
        heatPumpReady,

      fortyPercentReady:
        fortyPercentReady,

      heatingUnitCount:
        heatQty()
    };
  };

window.focusHVACMethodSelection =
  function(){

    if(
      selectedMethod ===
        METHODS.HEATPUMP &&
      !hpCompressorSupplemental
    ){

      const hpPanel =
        ensureHeatPumpQuestions();

      if(hpPanel){

        hpPanel.scrollIntoView({
          behavior:'smooth',
          block:'center'
        });

        const first =
          hpPanel.querySelector(
            '.heatpump-answer'
          );

        if(first){
          first.focus();
        }

        return;
      }
    }

    const panel =
      ensureMethodPanel();

    if(panel){

      panel.scrollIntoView({
        behavior:'smooth',
        block:'center'
      });

      const first =
        panel.querySelector(
          '.heating-method-choice'
        );

      if(first){
        first.focus();
      }
    }
  };

window.getHVACRowLabel =
  function(row){

    if(
      selectedMethod ===
      METHODS.HEATPUMP
    ){
      return (
        row === 37 ||
        row === 39
      )
        ? 'Heat Pump Compressor'
        : 'Supplemental Electric Heat';
    }

    return (
      row === 37 ||
      row === 39
    )
      ? 'Air Conditioning'
      : 'Heating';
  };

window.syncFortyMethodEntryControls =
  syncFortyMethodEntryControls;

window.getHVACMethodSummary =
  function(){

    if(
      selectedMethod ===
      METHODS.CENTRAL
    ){
      return (
        'Cooling Only / Central Electric Heat — ' +
        'larger of cooling at 100% or heat at 65%'
      );
    }

    if(
      selectedMethod ===
      METHODS.FORTY
    ){
      return (
        'Four or More Separately Controlled Electric Heating Systems — ' +
        'larger of cooling at 100% or qualifying heat at 40%'
      );
    }

    if(
      selectedMethod ===
      METHODS.HEATPUMP
    ){

      if(
        hpCompressorSupplemental ===
        'yes'
      ){
        return (
          'Heat Pump — compressor at 100% plus supplemental ' +
          'electric heat at 65%; compared with cooling'
        );
      }

      if(
        hpCompressorSupplemental ===
        'no'
      ){
        return (
          'Heat Pump — compressor locked out during supplemental heat; ' +
          'supplemental heat at 65% compared with cooling'
        );
      }

      return (
        'Heat Pump — operating condition not selected'
      );
    }

    return 'Not selected';
  };

window.isHVACManagedRowApplicable =
  function(row){

    return (
      activeHVACManagedRows.has(
        Number(row)
      ) &&
      rowService(
        Number(row)
      ) > 0
    );
  };

window.hvacLoadCalculation =
  function(){

    ensure40Rows();

    updateMethodUI();

    const ac1 =
      rowService(37);

    const ac2 =
      rowService(39);

    const heat1 =
      rowService(38);

    const heat2 =
      rowService(40);

    const serviceAC =
      ac1 + ac2;

    const serviceHeatTotal =
      heat1 + heat2;

    let service =
      serviceAC;

    let generator = 0;

    let generatorAC = 0;

    let generatorHeat = 0;

    if(!selectedMethod){

      setManagedRowsActive([]);

      setOutput('e37',serviceAC);
      setOutput('e38',0);
      setOutput('e39',0);
      setOutput('e40',0);
      setOutput('e41',0);

      setOutput('f37',0);
      setOutput('f38',0);
      setOutput('f39',0);
      setOutput('f40',0);
      setOutput('f41',0);

      return {
        service:service,
        generator:0,
        serviceAC:serviceAC,
        generatorAC:0,
        serviceHeating:0,
        generatorHeating:0,
        method:''
      };
    }

    if(
      selectedMethod ===
      METHODS.CENTRAL
    ){

      /* Central method always remains cooling at 100%
         versus electric heat at 65%. Entering four or
         more heating units does not switch methods. */

      const serviceHeating =
        serviceHeatTotal *
        0.65;

      const acControls =
        serviceAC >=
        serviceHeating;

      if(acControls){

        setManagedRowsActive(
          [37,39]
        );

        generatorAC =
          remainingVA(37) +
          remainingVA(39);

        generator =
          generatorAC;

      }else{

        setManagedRowsActive(
          [38,40]
        );

        generatorHeat =
          (
            remainingVA(38) +
            remainingVA(40)
          ) * 0.65;

        generator =
          generatorHeat;
      }

      service =
        Math.max(
          serviceAC,
          serviceHeating
        );

      setOutput(
        'e37',
        acControls
          ? ac1
          : 0
      );

      setOutput(
        'e39',
        acControls
          ? ac2
          : 0
      );

      setOutput(
        'e38',
        acControls
          ? 0
          : heat1 * 0.65
      );

      setOutput(
        'e40',
        acControls
          ? 0
          : heat2 * 0.65
      );

      setOutput(
        'e41',
        0
      );

      setOutput(
        'f37',
        acControls
          ? remainingVA(37)
          : 0
      );

      setOutput(
        'f39',
        acControls
          ? remainingVA(39)
          : 0
      );

      setOutput(
        'f38',
        acControls
          ? 0
          : remainingVA(38) *
            0.65
      );

      setOutput(
        'f40',
        acControls
          ? 0
          : remainingVA(40) *
            0.65
      );

      setOutput(
        'f41',
        0
      );

      return {
        service:service,
        generator:generator,
        serviceAC:serviceAC,
        generatorAC:generatorAC,
        serviceHeating:
          serviceHeating,
        generatorHeating:
          generatorHeat,
        method:selectedMethod
      };
    }

    if(
      selectedMethod ===
      METHODS.FORTY
    ){

      const totalQty =
        heatQty();

      const qualifies =
        totalQty >= 4;

      const serviceHeating =
        serviceHeatTotal *
        0.40;

      const acControls =
        serviceAC >=
        serviceHeating;

      const q41_1 =
        document.getElementById(
          'q41_1'
        );

      const v41_1 =
        document.getElementById(
          'v41_1'
        );

      const q41_2 =
        document.getElementById(
          'q41_2'
        );

      const v41_2 =
        document.getElementById(
          'v41_2'
        );

      if(q41_1){

        q41_1.value =
          value('q38') > 0
            ? String(
                Math.floor(
                  value('q38')
                )
              )
            : '';
      }

      if(v41_1){

        v41_1.value =
          heat1 > 0
            ? Math.round(
                heat1 * 0.40
              ).toLocaleString(
                'en-US'
              ) + ' VA'
            : '';
      }

      if(q41_2){

        q41_2.value =
          value('q40') > 0
            ? String(
                Math.floor(
                  value('q40')
                )
              )
            : '';
      }

      if(v41_2){

        v41_2.value =
          heat2 > 0
            ? Math.round(
                heat2 * 0.40
              ).toLocaleString(
                'en-US'
              ) + ' VA'
            : '';
      }

      service =
        Math.max(
          serviceAC,
          serviceHeating
        );

      /* In the 40% method, only the Heat at 40%
         controls may be used. */

      setManagedRowsActive(
        [38,40]
      );

      if(acControls){

        generatorAC =
          serviceAC;

        generator =
          generatorAC;

      }else{

        /* Each heating row is reduced independently
           before applying 40%. */

        generatorHeat =
          (
            remainingVA(38) +
            remainingVA(40)
          ) * 0.40;

        generator =
          generatorHeat;
      }

      setOutput(
        'e37',
        acControls
          ? ac1
          : 0
      );

      setOutput(
        'e39',
        acControls
          ? ac2
          : 0
      );

      setOutput('e38',0);
      setOutput('e40',0);

      setOutput(
        'e41',
        acControls
          ? 0
          : serviceHeating
      );

      setOutput(
        'f37',
        acControls
          ? remainingVA(37)
          : 0
      );

      setOutput(
        'f39',
        acControls
          ? remainingVA(39)
          : 0
      );

      setOutput('f38',0);
      setOutput('f40',0);

      setOutput(
        'f41',
        acControls
          ? 0
          : generatorHeat
      );

      syncFortyMethodEntryControls();

      sync40PercentManagedControls();

      return {
        service:service,
        generator:generator,
        serviceAC:serviceAC,
        generatorAC:generatorAC,
        serviceHeating:
          serviceHeating,
        generatorHeating:
          generatorHeat,
        method:selectedMethod,
        qualifies:qualifies
      };
    }

    if(
      !hpCompressorSupplemental
    ){

      setManagedRowsActive([]);

      setOutput('e37',0);
      setOutput('e38',0);
      setOutput('e39',0);
      setOutput('e40',0);
      setOutput('e41',0);

      setOutput('f37',0);
      setOutput('f38',0);
      setOutput('f39',0);
      setOutput('f40',0);
      setOutput('f41',0);

      return {
        service:0,
        generator:0,
        serviceAC:serviceAC,
        generatorAC:0,
        serviceHeating:0,
        generatorHeating:0,
        method:selectedMethod,
        heatPumpReady:false
      };
    }

    const compressorWithSupplemental =
      hpCompressorSupplemental ===
      'yes';

    const serviceCompressor =
      serviceAC;

    const serviceSupplemental =
      serviceHeatTotal *
      0.65;

    /* Standard heat-pump heating condition:
       YES = compressor once at 100%
       + supplemental heat at 65%.
       NO = compressor locked out;
       supplemental heat at 65% only.
       Compare with cooling and use larger. */

    const serviceHeating =
      (
        compressorWithSupplemental
          ? serviceCompressor
          : 0
      ) +
      serviceSupplemental;

    const coolingControls =
      serviceAC >=
      serviceHeating;

    service =
      Math.max(
        serviceAC,
        serviceHeating
      );

    if(coolingControls){

      setManagedRowsActive(
        [37,39]
      );

      generatorAC =
        remainingVA(37) +
        remainingVA(39);

      generator =
        generatorAC;

    }else{

      const activeRows =
        compressorWithSupplemental
          ? [37,38,39,40]
          : [38,40];

      setManagedRowsActive(
        activeRows
      );

      generatorAC =
        compressorWithSupplemental
          ? remainingVA(37) +
            remainingVA(39)
          : 0;

      generatorHeat =
        (
          remainingVA(38) +
          remainingVA(40)
        ) * 0.65;

      generator =
        generatorAC +
        generatorHeat;
    }

    setOutput(
      'e37',
      coolingControls
        ? ac1
        : (
            compressorWithSupplemental
              ? ac1
              : 0
          )
    );

    setOutput(
      'e39',
      coolingControls
        ? ac2
        : (
            compressorWithSupplemental
              ? ac2
              : 0
          )
    );

    setOutput(
      'e38',
      coolingControls
        ? 0
        : heat1 * 0.65
    );

    setOutput(
      'e40',
      coolingControls
        ? 0
        : heat2 * 0.65
    );

    setOutput(
      'e41',
      0
    );

    setOutput(
      'f37',
      coolingControls
        ? remainingVA(37)
        : (
            compressorWithSupplemental
              ? remainingVA(37)
              : 0
          )
    );

    setOutput(
      'f39',
      coolingControls
        ? remainingVA(39)
        : (
            compressorWithSupplemental
              ? remainingVA(39)
              : 0
 …24228 tokens truncated…(
      'e38',
      serviceHeating
    );

    setOutput(
      'e39',
      0
    );

    setOutput(
      'e40',
      0
    );

    setOutput(
      'e41',
      0
    );

    setOutput(
      'f37',
      generatorAC
    );

    setOutput(
      'f38',
      generatorHeating
    );

    setOutput(
      'f39',
      0
    );

    setOutput(
      'f40',
      0
    );

    setOutput(
      'f41',
      0
    );

    updateOutputs();

    return {
      service,
      generator,
      serviceAC,
      generatorAC,
      serviceHeating,
      generatorHeating,
      method:
        selected().join(','),
      multipleHeatTypes:
        selected().length > 1
    };
  };

window.validateHVACMethodSelection =
  function(){

    const sel =
      selected();

    const hpReady =
      !sel.includes(
        'heatpump'
      ) ||
      !!hpAnswer();

    return {
      valid:
        sel.length > 0 &&
        hpReady,

      method:
        sel.join(','),

      methodSelected:
        sel.length > 0,

      heatPumpReady:
        hpReady,

      fortyPercentReady:
        true,

      heatingUnitCount:
        heatingQty(
          'separate40'
        )
    };
  };

window.getHVACMethodSummary =
  function(){

    const sel =
      selected();

    const names = {

      central65:
        'Central electric heat at 65%',

      separate40:
        (
          fortyApplies()
            ? 'Separately controlled electric heat at 40%'
            : 'Separately controlled electric heat at 100% — fewer than four units'
        ),

      heatpump:
        'Heat pump with supplemental electric heat'
    };

    return sel.length
      ? (
          'Heating method: ' +
          sel
            .map(
              m => names[m]
            )
            .join(' + ')
        )
      : 'Not selected';
  };

const oldReset =
  window.resetHeatingMethodSelection;

window.resetHeatingMethodSelection =
  function(){

    try{

      if(
        typeof oldReset ===
        'function'
      ){
        oldReset();
      }

    }catch(e){}

    data = {};

    managed = {};

    counts = {};

    save();

    render();

    calculate();
  };

function init(){

  const version =
    document.querySelector(
      '.app-version'
    );

  if(version){

    version.textContent =
      'NEC 2023 | Version 2.0 — V5.41 Auto Save Restore Fixed';
  }

  render();

  calculate();

  const panel =
    document.getElementById(
      'heatingMethodPanel'
    );

  if(panel){

    panel.addEventListener(
      'click',
      () =>
        setTimeout(
          ()=>{

            render();

            calculate();
          },
          60
        ),
      true
    );
  }
}

if(
  document.readyState ===
  'loading'
){

  document.addEventListener(
    'DOMContentLoaded',
    () =>
      setTimeout(
        init,
        120
      )
  );

}else{

  setTimeout(
    init,
    120
  );
}

})();
(function(){

'use strict';

const METHODS_KEY =
  'loadcalcpro_hvac_selected_methods_v1';

const HP_KEY =
  'loadcalcpro_hvac_multi_hp_answer_v1';

const DATA_KEY =
  'loadcalcpro_hvac_method_sections_v57';

const MANAGED_KEY =
  'loadcalcpro_hvac_method_managed_v57';

const COUNT_KEY =
  'loadcalcpro_hvac_visible_system_counts_v522';

const BASE_MANAGED_ROWS = [
  10,11,12,13,14,15,16,17,18,19,
  20,21,22,23,24,25,26,27,28,29,
  30,42,43,47
];

const METHODS = {
  central65:true,
  separate40:true,
  heatpump:true
};

function readJSON(
  key,
  fallback
){

  try{

    const v =
      JSON.parse(
        localStorage.getItem(key) ||
        ''
      );

    return (
      v &&
      typeof v === 'object'
    )
      ? v
      : fallback;

  }catch(e){

    return fallback;
  }
}

function selected(){

  const a =
    readJSON(
      METHODS_KEY,
      []
    );

  return Array.isArray(a)
    ? a.filter(
        m => METHODS[m]
      )
    : [];
}

function hpAnswer(){

  return (
    localStorage.getItem(
      HP_KEY
    ) || ''
  );
}

function data(){

  return readJSON(
    DATA_KEY,
    {}
  );
}

function managed(){

  return readJSON(
    MANAGED_KEY,
    {}
  );
}

function counts(){

  return readJSON(
    COUNT_KEY,
    {}
  );
}

function typeFor(
  kind,
  index
){

  return (
    kind +
    (
      index === 1
        ? ''
        : index
    )
  );
}

function key(
  method,
  type
){

  return (
    method +
    '_' +
    type
  );
}

function count(method){

  const n =
    Math.floor(
      Number(
        counts()[method]
      ) || 1
    );

  return Math.max(
    1,
    Math.min(
      3,
      n
    )
  );
}

function item(
  method,
  type
){

  return (
    data()[
      key(
        method,
        type
      )
    ] || {}
  );
}

function qty(
  method,
  type
){

  return Math.max(
    0,
    Math.floor(
      Number(
        item(
          method,
          type
        ).qty
      ) || 0
    )
  );
}

function va(
  method,
  type
){

  return Math.max(
    0,
    Number(
      item(
        method,
        type
      ).va
    ) || 0
  );
}

function total(
  method,
  type
){

  return (
    qty(
      method,
      type
    ) *
    va(
      method,
      type
    )
  );
}

function managedQty(
  method,
  type
){

  const q =
    qty(
      method,
      type
    );

  const raw =
    managed()[
      key(
        method,
        type
      )
    ];

  let n =
    raw === true
      ? q
      : Math.floor(
          Number(raw) || 0
        );

  return Math.max(
    0,
    Math.min(
      q,
      n
    )
  );
}

function remaining(
  method,
  type
){

  return (
    Math.max(
      qty(
        method,
        type
      ) -
      managedQty(
        method,
        type
      ),
      0
    ) *
    va(
      method,
      type
    )
  );
}

function aggregate(
  method,
  kind,
  generator
){

  let n = 0;

  for(
    let i = 1;
    i <= count(method);
    i++
  ){

    n += (
      generator
        ? remaining
        : total
    )(
      method,
      typeFor(
        kind,
        i
      )
    );
  }

  return n;
}

function heatQty(method){

  let n = 0;

  for(
    let i = 1;
    i <= count(method);
    i++
  ){

    n += qty(
      method,
      typeFor(
        'heat',
        i
      )
    );
  }

  return n;
}

function heatFactor(method){

  return (
    method ===
    'separate40'
  )
    ? (
        heatQty(method) >= 4
          ? .40
          : .65
      )
    : .65;
}

function fmt(n){

  return n
    ? Math.round(n)
        .toLocaleString(
          'en-US'
        )
    : '';
}

function set(
  selector,
  value
){

  const e =
    document.querySelector(
      selector
    );

  if(e){
    e.textContent =
      value;
  }
}

function methodResult(
  method,
  generator
){

  const c =
    aggregate(
      method,
      'ac',
      generator
    );

  const hBase =
    aggregate(
      method,
      'heat',
      generator
    );

  const h =
    hBase *
    heatFactor(method);

  if(
    method ===
    'heatpump'
  ){

    const hp =
      hpAnswer();

    if(
      hp === 'yes'
    ){

      return {
        total:c + h,
        c:c,
        h:h,
        controller:'both'
      };
    }

    if(
      hp === 'no'
    ){

      return c >= h
        ? {
            total:c,
            c:c,
            h:0,
            controller:'cooling'
          }
        : {
            total:h,
            c:0,
            h:h,
            controller:'heating'
          };
    }

    return {
      total:0,
      c:0,
      h:0,
      controller:''
    };
  }

  return c >= h
    ? {
        total:c,
        c:c,
        h:0,
        controller:'cooling'
      }
    : {
        total:h,
        c:0,
        h:h,
        controller:'heating'
      };
}

function updateSectionOutputs(){

  selected()
    .forEach(
      function(method){

        const sf =
          methodResult(
            method,
            false
          );

        const gf =
          methodResult(
            method,
            true
          );

        const factor =
          heatFactor(method);

        for(
          let i = 1;
          i <= count(method);
          i++
        ){

          const ac =
            typeFor(
              'ac',
              i
            );

          const heat =
            typeFor(
              'heat',
              i
            );

          const acS =
            (
              sf.controller ===
                'cooling' ||
              sf.controller ===
                'both'
            )
              ? total(
                  method,
                  ac
                )
              : 0;

          const acG =
            (
              gf.controller ===
                'cooling' ||
              gf.controller ===
                'both'
            )
              ? remaining(
                  method,
                  ac
                )
              : 0;

          const hS =
            (
              sf.controller ===
                'heating' ||
              sf.controller ===
                'both'
            )
              ? total(
                  method,
                  heat
                ) *
                factor
              : 0;

          const hG =
            (
              gf.controller ===
                'heating' ||
              gf.controller ===
                'both'
            )
              ? remaining(
                  method,
                  heat
                ) *
                factor
              : 0;

          set(
            '[data-v522-output="' +
            key(
              method,
              ac
            ) +
            '_service"]',
            fmt(acS)
          );

          set(
            '[data-v522-output="' +
            key(
              method,
              ac
            ) +
            '_generator"]',
            fmt(acG)
          );

          set(
            '[data-v522-output="' +
            key(
              method,
              heat
            ) +
            '_service"]',
            fmt(hS)
          );

          set(
            '[data-v522-output="' +
            key(
              method,
              heat
            ) +
            '_generator"]',
            fmt(hG)
          );

          if(
            method ===
            'separate40'
          ){

            set(
              '[data-v522-forty="' +
              i +
              '_service"]',
              heatQty(method) >= 4
                ? fmt(
                    total(
                      method,
                      heat
                    ) *
                    .40
                  )
                : ''
            );

            set(
              '[data-v522-forty="' +
              i +
              '_generator"]',
              heatQty(method) >= 4
                ? fmt(
                    remaining(
                      method,
                      heat
                    ) *
                    .40
                  )
                : ''
            );

            set(
              '[data-v522-forty-note="' +
              i +
              '"]',
              heatQty(method) >= 4
                ? 'Calculated automatically'
                : '65% applied — fewer than 4 total heating units'
            );
          }
        }

        if(
          method ===
          'separate40'
        ){

          const c =
            aggregate(
              method,
              'ac',
              false
            );

          const h =
            aggregate(
              method,
              'heat',
              false
            ) *
            factor;

          const used =
            Math.max(
              c,
              h
            );

          set(
            '[data-v522-compare="qty"]',
            String(
              heatQty(method)
            )
          );

          set(
            '[data-v522-compare="cooling"]',
            fmt(c)
          );

          set(
            '[data-v522-compare="heating-used"]',
            fmt(h)
          );

          const label =
            document.querySelector(
              '[data-v522-heat-label]'
            );

          if(label){

            label.textContent =
              heatQty(method) >= 4
                ? 'Heating at 40%'
                : 'Heating at 65%';
          }

          set(
            '[data-v522-compare="used"]',
            fmt(used) +
            (
              h > c
                ? ' — Heating'
                : ' — Cooling'
            )
          );
        }
      }
    );
}

window.hvacLoadCalculation =
  function(){

    let service = 0;

    let generator = 0;

    let serviceAC = 0;

    let generatorAC = 0;

    let serviceHeating = 0;

    let generatorHeating = 0;

    selected()
      .forEach(
        function(method){

          const s =
            methodResult(
              method,
              false
            );

          const g =
            methodResult(
              method,
              true
            );

          service +=
            s.total;

          generator +=
            g.total;

          serviceAC +=
            s.c;

          serviceHeating +=
            s.h;

          generatorAC +=
            g.c;

          generatorHeating +=
            g.h;
        }
      );

    setOutput(
      'e37',
      serviceAC
    );

    setOutput(
      'e38',
      serviceHeating
    );

    setOutput('e39',0);
    setOutput('e40',0);
    setOutput('e41',0);

    setOutput(
      'f37',
      generatorAC
    );

    setOutput(
      'f38',
      generatorHeating
    );

    setOutput('f39',0);
    setOutput('f40',0);
    setOutput('f41',0);

    updateSectionOutputs();

    return {
      service:service,
      generator:generator,
      serviceAC:serviceAC,
      generatorAC:generatorAC,
      serviceHeating:
        serviceHeating,
      generatorHeating:
        generatorHeating,
      method:
        selected().join(','),
      multipleHeatTypes:
        selected().length > 1
    };
  };

window.validateHVACMethodSelection =
  function(){

    const sel =
      selected();

    const hpReady =
      !sel.includes(
        'heatpump'
      ) ||
      !!hpAnswer();

    return {
      valid:
        sel.length > 0 &&
        hpReady,

      method:
        sel.join(','),

      methodSelected:
        sel.length > 0,

      heatPumpReady:
        hpReady,

      fortyPercentReady:
        true,

      heatingUnitCount:
        heatQty(
          'separate40'
        )
    };
  };

window.getHVACMethodSummary =
  function(){

    const names = {

      central65:
        'Central electric heat at 65%',

      separate40:
        (
          heatQty(
            'separate40'
          ) >= 4
            ? 'Separately controlled electric heat at 40%'
            : 'Separately controlled electric heat at 65% — fewer than four units'
        ),

      heatpump:
        'Heat pump with supplemental electric heat'
    };

    const sel =
      selected();

    return sel.length
      ? (
          'Heating method: ' +
          sel
            .map(
              m => names[m]
            )
            .join(' + ')
        )
      : 'Not selected';
  };

window.getCompleteManagedLoadCount =
  function(){

    let n = 0;

    BASE_MANAGED_ROWS
      .forEach(
        function(r){

          const q =
            typeof positiveQuantity ===
            'function'
              ? positiveQuantity(
                  'q' + r
                )
              : 0;

          if(
            q > 0 &&
            typeof managedQuantity ===
              'function'
          ){

            n += Math.min(
              q,
              managedQuantity(r)
            );
          }
        }
      );

    const m =
      managed();

    selected()
      .forEach(
        function(method){

          for(
            let i = 1;
            i <= count(method);
            i++
          ){

            n += managedQty(
              method,
              typeFor(
                'ac',
                i
              )
            );

            n += managedQty(
              method,
              typeFor(
                'heat',
                i
              )
            );
          }
        }
      );

    return n;
  };

window.applicableManagedLoadCount =
  window.getCompleteManagedLoadCount;

function printRow(
  label,
  q,
  s,
  g
){

  if(
    s <= 0 &&
    g <= 0
  ){
    return '';
  }

  return (
    '<tr>' +
    '<td>' +
    escapeHTML(label) +
    '</td>' +
    '<td class="quantity">' +
    (q || '') +
    '</td>' +
    '<td class="number">' +
    fmt(s) +
    '</td>' +
    '<td class="number">' +
    fmt(g) +
    '</td>' +
    '</tr>'
  );
}

function buildPrintHVAC(){

  let html = '';

  selected()
    .forEach(
      function(method){

        const sr =
          methodResult(
            method,
            false
          );

        const gr =
          methodResult(
            method,
            true
          );

        const factor =
          heatFactor(method);

        for(
          let i = 1;
          i <= count(method);
          i++
        ){

          const ac =
            typeFor(
              'ac',
              i
            );

          const heat =
            typeFor(
              'heat',
              i
            );

          if(
            sr.controller ===
              'cooling' ||
            sr.controller ===
              'both' ||
            gr.controller ===
              'cooling' ||
            gr.controller ===
              'both'
          ){

            html +=
              printRow(
                method ===
                  'heatpump'
                  ? (
                      'Heat Pump Compressor ' +
                      i
                    )
                  : (
                      'Air Conditioning Unit ' +
                      i
                    ),

                qty(
                  method,
                  ac
                ),

                (
                  sr.controller ===
                    'cooling' ||
                  sr.controller ===
                    'both'
                )
                  ? total(
                      method,
                      ac
                    )
                  : 0,

                (
                  gr.controller ===
                    'cooling' ||
                  gr.controller ===
                    'both'
                )
                  ? remaining(
                      method,
                      ac
                    )
                  : 0
              );
          }

          if(
            sr.controller ===
              'heating' ||
            sr.controller ===
              'both' ||
            gr.controller ===
              'heating' ||
            gr.controller ===
              'both'
          ){

            html +=
              printRow(
                (
                  method ===
                    'heatpump'
                    ? 'Supplemental Electric Heat '
                    : (
                        method ===
                          'central65'
                          ? 'Central Electric Heat '
                          : 'Separately Controlled Electric Heat '
                      )
                ) +
                i +
                ' at ' +
                Math.round(
                  factor * 100
                ) +
                '%',

                qty(
                  method,
                  heat
                ),

                (
                  sr.controller ===
                    'heating' ||
                  sr.controller ===
                    'both'
                )
                  ? total(
                      method,
                      heat
                    ) *
                    factor
                  : 0,

                (
                  gr.controller ===
                    'heating' ||
                  gr.controller ===
                    'both'
                )
                  ? remaining(
                      method,
                      heat
                    ) *
                    factor
                  : 0
              );
          }
        }
      }
    );

  return html;
}

const priorPrint =
  window.updatePrintRows;

window.updatePrintRows =
  function(d){

    priorPrint(d);

    d.managedLoadCount =
      window
        .getCompleteManagedLoadCount();

    const report =
      document.getElementById(
        'printReport'
      );

    if(!report){
      return;
    }

    const summary =
      report.querySelector(
        '.print-method-details'
      );

    if(summary){

      const parts =
        summary.querySelectorAll(
          '.summary-item span'
        );

      if(parts[1]){

        parts[1].textContent =
          String(
            d.managedLoadCount
          );
      }
    }

    const table =
      report.querySelector(
        '.print-table'
      );

    const tfoot =
      table &&
      table.querySelector(
        'tfoot'
      );

    if(tfoot){

      const rows =
        Array.from(
          tfoot.children
        );

      const start =
        rows.findIndex(
          r =>
            r.classList.contains(
              'print-section-row'
            ) &&
            r.textContent.trim() ===
              'HVAC Load'
        );

      if(start >= 0){

        let end =
          start + 1;

        while(
          end < rows.length &&
          !rows[end]
            .classList.contains(
              'print-section-row'
            ) &&
          !rows[end]
            .classList.contains(
              'final-total-row'
            )
        ){
          end++;
        }

        for(
          let i = end - 1;
          i > start;
          i--
        ){
          rows[i].remove();
        }

        const hv =
          buildPrintHVAC();

        if(hv){

          rows[start]
            .insertAdjacentHTML(
              'afterend',
              hv
            );

        }else{

          rows[start].remove();
        }
      }
    }

    let note =
      report.querySelector(
        '.v534-print-advisory'
      );

    const incomplete =
      numberValue('q5') <= 0 ||
      positiveQuantity('q6') < 2 ||
      positiveQuantity('q7') < 1;

    if(incomplete){

      if(!note){

        note =
          document.createElement(
            'div'
          );

        note.className =
          'v534-print-advisory';

        const code =
          report.querySelector(
            '.print-code-note'
          );

        if(code){

          code.parentNode
            .insertBefore(
              note,
              code
            );

        }else{

          report.appendChild(
            note
          );
        }
      }

      note.textContent =
        'Note: General dwelling load information is incomplete. Verify dwelling square footage, required small-appliance circuits, and laundry circuit before using this report as a complete NEC 2023 Optional Method dwelling load calculation.';

    }else if(note){

      note.remove();
    }

    syncBottom(d);
  };

function syncBottom(d){

  const sa =
    document.getElementById(
      'serviceAmpsView'
    );

  const ga =
    document.getElementById(
      'generatorAmpsView'
    );

  const sv =
    document.getElementById(
      'serviceTotalVAView'
    );

  const gv =
    document.getElementById(
      'generatorTotalVAView'
    );

  const mc =
    document.getElementById(
      'bottomManagedLoadCount'
    );

  if(sa){
    sa.textContent =
      Math.ceil(
        d.serviceCurrent
      ) +
      ' A';
  }

  if(ga){
    ga.textContent =
      Math.ceil(
        d.generatorCurrent
      ) +
      ' A';
  }

  if(sv){

    sv.textContent =
      fmt(
        d.serviceTotalVA
      ) || '0';
  }

  if(gv){

    gv.textContent =
      fmt(
        d.generatorTotalVA
      ) || '0';
  }

  if(mc){

    mc.textContent =
      String(
        window
          .getCompleteManagedLoadCount()
      );
  }
}

function init(){

  const v =
    document.querySelector(
      '.app-version'
    );

  if(v){

    v.textContent =
      'NEC 2023 | Version 2.0 — V5.41 Auto Save Restore Fixed';
  }

  document.addEventListener(
    'input',
    function(){

      setTimeout(
        updateSectionOutputs,
        0
      );
    }
  );

  setTimeout(
    function(){

      if(
        !restorePromptOpen
      ){
        calculate();
      }
    },
    180
  );
}

if(
  document.readyState ===
  'loading'
){

  document.addEventListener(
    'DOMContentLoaded',
    init
  );

}else{

  init();
}

})();
(function(){

'use strict';

const METHODS_KEY =
  'loadcalcpro_hvac_selected_methods_v1';

const HP_KEY =
  'loadcalcpro_hvac_multi_hp_answer_v1';

const DATA_KEY =
  'loadcalcpro_hvac_method_sections_v57';

const MANAGED_KEY =
  'loadcalcpro_hvac_method_managed_v57';

const COUNT_KEY =
  'loadcalcpro_hvac_visible_system_counts_v522';

const BASE_MANAGED_ROWS = [
  10,11,12,13,14,15,16,17,18,19,
  20,21,22,23,24,25,26,27,28,29,
  30,42,43,47
];

const VALID = {
  central65:true,
  separate40:true,
  heatpump:true
};

function readJSON(
  k,
  f
){

  try{

    const v =
      JSON.parse(
        localStorage.getItem(k) ||
        ''
      );

    return (
      v &&
      typeof v === 'object'
    )
      ? v
      : f;

  }catch(e){

    return f;
  }
}

function writeJSON(
  k,
  v
){

  try{

    localStorage.setItem(
      k,
      JSON.stringify(v)
    );

  }catch(e){}
}

function selected(){

  const a =
    readJSON(
      METHODS_KEY,
      []
    );

  return Array.isArray(a)
    ? a.filter(
        m => VALID[m]
      )
    : [];
}

function hpAnswer(){

  return (
    localStorage.getItem(
      HP_KEY
    ) || ''
  );
}

function dataset(){

  return readJSON(
    DATA_KEY,
    {}
  );
}

function managedMap(){

  return readJSON(
    MANAGED_KEY,
    {}
  );
}

function counts(){

  return readJSON(
    COUNT_KEY,
    {}
  );
}

function typeFor(
  kind,
  index
){

  return (
    kind +
    (
      index === 1
        ? ''
        : index
    )
  );
}

function key(
  method,
  type
){

  return (
    method +
    '_' +
    type
  );
}

function count(method){

  const n =
    Math.floor(
      Number(
        counts()[method]
      ) || 1
    );

  return Math.max(
    1,
    Math.min(
      3,
      n
    )
  );
}

function item(
  method,
  type
){

  return (
    dataset()[
      key(
        method,
        type
      )
    ] || {}
  );
}

function qty(
  method,
  type
){

  return Math.max(
    0,
    Math.floor(
      Number(
        item(
          method,
          type
        ).qty
      ) || 0
    )
  );
}

function va(
  method,
  type
){

  return Math.max(
    0,
    Number(
      item(
        method,
        type
      ).va
    ) || 0
  );
}

function total(
  method,
  type
){

  return (
    qty(
      method,
      type
    ) *
    va(
      method,
      type
    )
  );
}

function managedQty(
  method,
  type
){

  const q =
    qty(
      method,
      type
    );

  const raw =
    managedMap()[
      key(
        method,
        type
      )
    ];

  let n =
    raw === true
      ? q
      : Math.floor(
          Number(raw) || 0
        );

  return Math.max(
    0,
    Math.min(
      q,
      n
    )
  );
}

function remaining(
  method,
  type
){

  return (
    Math.max(
      qty(
        method,
        type
      ) -
      managedQty(
        method,
        type
      ),
      0
    ) *
    va(
      method,
      type
    )
  );
}

function aggregate(
  method,
  kind,
  generator
){

  let n = 0;

  for(
    let i = 1;
    i <= count(method);
    i++
  ){

    n += (
      generator
        ? remaining
        : total
    )(
      method,
      typeFor(
        kind,
        i
      )
    );
  }

  return n;
}

function heatQty(method){

  let n = 0;

  for(
    let i = 1;
    i <= count(method);
    i++
  ){

    n += qty(
      method,
      typeFor(
        'heat',
        i
      )
    );
  }

  return n;
}

function heatFactor(method){

  return (
    method ===
    'separate40'
  )
    ? (
        heatQty(method) >= 4
          ? .40
          : .65
      )
    : .65;
}

function serviceController(method){

  const c =
    aggregate(
      method,
      'ac',
      false
    );

  const h =
    aggregate(
      method,
      'heat',
      false
    ) *
    heatFactor(method);

  if(
    method ===
      'heatpump' &&
    hpAnswer() ===
      'yes'
  ){
    return 'both';
  }

  if(
    method ===
      'heatpump' &&
    !hpAnswer()
  ){
    return '';
  }

  return c >= h
    ? 'cooling'
    : 'heating';
}

function methodResult(
  method,
  generator
){

  const controller =
    serviceController(
      method
    );

  const factor =
    heatFactor(method);

  const c =
    aggregate(
      method,
      'ac',
      generator
    );

  const h =
    aggregate(
      method,
      'heat',
      generator
    ) *
    factor;

  if(
    controller ===
    'both'
  ){

    return {
      total:c + h,
      c:c,
      h:h,
      controller:controller
    };
  }

  if(
    controller ===
    'cooling'
  ){

    return {
      total:c,
      c:c,
      h:0,
      controller:controller
    };
  }

  if(
    controller ===
    'heating'
  ){

    return {
      total:h,
      c:0,
      h:h,
      controller:controller
    };
  }

  return {
    total:0,
    c:0,
    h:0,
    controller:''
  };
}

function isActive(
  method,
  type
){

  const c =
    serviceController(
      method
    );

  return (
    c === 'both' ||
    (
      c === 'cooling' &&
      type.indexOf('ac') === 0
    ) ||
    (
      c === 'heating' &&
      type.indexOf('heat') === 0
    )
  );
}

function comparisonReady(
  method
){

  const cooling =
    aggregate(
      method,
      'ac',
      false
    );

  const heating =
    aggregate(
      method,
      'heat',
      false
    );

  if(
    method ===
      'heatpump' &&
    hpAnswer() ===
      'yes'
  ){
    return (
      cooling > 0 ||
      heating > 0
    );
  }

  return (
    cooling > 0 &&
    heating > 0
  );
}

function clearInactiveManaged(){

  const m =
    managedMap();

  let changed = false;

  selected()
    .forEach(method=>{

      if(
        !comparisonReady(
          method
        )
      ){
        return;
      }

      for(
        let i = 1;
        i <= count(method);
        i++
      ){

        for(
          const kind of [
            'ac',
            'heat'
          ]
        ){

          const t =
            typeFor(
              kind,
              i
            );

          const k =
            key(
              method,
              t
            );

          if(
            !isActive(
              method,
              t
            ) &&
            m[k]
          ){

            m[k] = 0;

            changed = true;
          }
        }
      }
    });

  if(changed){

    writeJSON(
      MANAGED_KEY,
      m
    );
  }

  return changed;
}

function fmt(n){

  return n
    ? Math.round(n)
        .toLocaleString(
          'en-US'
        )
    : '';
}

function setText(
  sel,
  v
){

  const e =
    document.querySelector(
      sel
    );

  if(e){
    e.textContent = v;
  }
}

function syncManagedUI(){

  clearInactiveManaged();

  document
    .querySelectorAll(
      '[data-v522-managed]'
    )
    .forEach(btn=>{

      const k =
        btn.dataset
          .v522Managed || '';

      const p =
        k.split('_');

      const method =
        p.shift();

      const type =
        p.join('_');

      const hasLoad =
        qty(
          method,
          type
        ) > 0 &&
        va(
          method,
          type
        ) > 0;

      const compared =
        !!VALID[method] &&
        comparisonReady(
          method
        );

      const controlling =
        !compared ||
        isActive(
          method,
          type
        );

      const usable =
        hasLoad &&
        controlling;

      const controls =
        btn.closest(
          '.v57-method-managed'
        );

      if(controls){

        controls.classList.toggle(
          'v539-hide-noncontrolling-managed',
          compared &&
          !controlling
        );

        controls.setAttribute(
          'aria-hidden',
          compared &&
          !controlling
            ? 'true'
            : 'false'
        );
      }

      btn.disabled =
        !usable;

      btn.classList.toggle(
        'v535-managed-inactive',
        !usable
      );

      btn.setAttribute(
        'aria-disabled',
        usable
          ? 'false'
          : 'true'
      );

      const row =
        btn.closest(
          '.v57-method-row'
        );

      if(row){

        row.classList.remove(
          'v535-noncontrolling-row'
        );
      }

      const qb =
        document.querySelector(
          '[data-v522-managed-qty="' +
          k +
          '"]'
        );

      if(qb){

        qb.disabled =
          !usable;

        qb.classList.toggle(
          'v535-managed-inactive',
          !usable
        );
      }
    });
}

function updateOutputs(){

  selected()
    .forEach(method=>{

      const s =
        methodResult(
          method,
          false
        );

      const g =
        methodResult(
          method,
          true
        );

      const factor =
        heatFactor(method);

      for(
        let i = 1;
        i <= count(method);
        i++
      ){

        const ac =
          typeFor(
            'ac',
            i
          );

        const heat =
          typeFor(
            'heat',
            i
          );

        const activeAC =
          s.controller ===
            'cooling' ||
          s.controller ===
            'both';

        const activeHeat =
          s.controller ===
            'heating' ||
          s.controller ===
            'both';

        setText(
          '[data-v522-output="' +
          key(
            method,
            ac
          ) +
          '_service"]',
          fmt(
            activeAC
              ? total(
                  method,
                  ac
                )
              : 0
          )
        );

        setText(
          '[data-v522-output="' +
          key(
            method,
            ac
          ) +
          '_generator"]',
          fmt(
            activeAC
              ? remaining(
                  method,
                  ac
                )
              : 0
          )
        );

        setText(
          '[data-v522-output="' +
          key(
            method,
            heat
          ) +
          '_service"]',
          fmt(
            activeHeat
              ? total(
                  method,
                  heat
                ) *
                factor
              : 0
          )
        );

        setText(
          '[data-v522-output="' +
          key(
            method,
            heat
          ) +
          '_generator"]',
          fmt(
            activeHeat
              ? remaining(
                  method,
                  heat
                ) *
                factor
              : 0
          )
        );

        if(
          method ===
          'separate40'
        ){

          setText(
            '[data-v522-forty="' +
            i +
            '_service"]',
            heatQty(method) >= 4
              ? fmt(
                  total(
                    method,
                    heat
                  ) *
                  .40
                )
              : ''
          );

          setText(
            '[data-v522-forty="' +
            i +
            '_generator"]',
            heatQty(method) >= 4 &&
            activeHeat
              ? fmt(
                  remaining(
                    method,
                    heat
                  ) *
                  .40
                )
              : ''
          );

          setText(
            '[data-v522-forty-note="' +
            i +
            '"]',
            heatQty(method) >= 4
              ? 'Calculated automatically'
              : '65% applied — fewer than 4 total heating units'
          );
        }
      }

      if(
        method ===
        'separate40'
      ){

        const c =
          aggregate(
            method,
            'ac',
            false
          );

        const h =
          aggregate(
            method,
            'heat',
            false
          ) *
          factor;

        const used =
          Math.max(
            c,
            h
          );

        setText(
          '[data-v522-compare="qty"]',
          String(
            heatQty(method)
          )
        );

        setText(
          '[data-v522-compare="cooling"]',
          fmt(c)
        );

        setText(
          '[data-v522-compare="heating-used"]',
          fmt(h)
        );

        const label =
          document.querySelector(
            '[data-v522-heat-label]'
          );

        if(label){

          label.textContent =
            heatQty(method) >= 4
              ? 'Heating at 40%'
              : 'Heating at 65%';
        }

        setText(
          '[data-v522-compare="used"]',
          fmt(used) +
          (
            h > c
              ? ' — Heating'
              : ' — Cooling'
          )
        );
      }
    });

  syncManagedUI();
}

window.hvacLoadCalculation =
  function(){

    clearInactiveManaged();

    let service = 0;

    let generator = 0;

    let serviceAC = 0;

    let generatorAC = 0;

    let serviceHeating = 0;

    let generatorHeating = 0;

    selected()
      .forEach(method=>{

        const s =
          methodResult(
            method,
            false
          );

        const g =
          methodResult(
            method,
            true
          );

        service += s.total;

        generator += g.total;

        serviceAC += s.c;

        serviceHeating += s.h;

        generatorAC += g.c;

        generatorHeating += g.h;
      });

    setOutput(
      'e37',
      serviceAC
    );

    setOutput(
      'e38',
      serviceHeating
    );

    setOutput('e39',0);
    setOutput('e40',0);
    setOutput('e41',0);

    setOutput(
      'f37',
      generatorAC
    );

    setOutput(
      'f38',
      generatorHeating
    );

    setOutput('f39',0);
    setOutput('f40',0);
    setOutput('f41',0);

    updateOutputs();

    return {
      service,
      generator,
      serviceAC,
      generatorAC,
      serviceHeating,
      generatorHeating,
      method:
        selected().join(','),
      multipleHeatTypes:
        selected().length > 1
    };
  };

window.getCompleteManagedLoadCount =
  function(){

    let n = 0;

    BASE_MANAGED_ROWS
      .forEach(r=>{

        const q =
          typeof positiveQuantity ===
            'function'
            ? positiveQuantity(
                'q' + r
              )
            : 0;

        if(
          q > 0 &&
          typeof managedQuantity ===
            'function'
        ){

          n += Math.min(
            q,
            managedQuantity(r)
          );
        }
      });

    selected()
      .forEach(method=>{

        for(
          let i = 1;
          i <= count(method);
          i++
        ){

          for(
            const kind of [
              'ac',
              'heat'
            ]
          ){

            const t =
              typeFor(
                kind,
                i
              );

            if(
              isActive(
                method,
                t
              )
            ){

              n += managedQty(
                method,
                t
              );
            }
          }
        }
      });

    return n;
  };

window.applicableManagedLoadCount =
  window.getCompleteManagedLoadCount;

function escape(s){

  return String(s)
    .replace(
      /[&<>"']/g,
      ch => ({
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        '"':'&quot;',
        "'":'&#39;'
      }[ch])
    );
}

function printRow(
  label,
  q,
  s,
  g
){

  if(
    s <= 0 &&
    g <= 0
  ){
    return '';
  }

  return (
    '<tr>' +
    '<td>' +
    escape(label) +
    '</td>' +
    '<td class="quantity">' +
    (q || '') +
    '</td>' +
    '<td class="number">' +
    fmt(s) +
    '</td>' +
    '<td class="number">' +
    fmt(g) +
    '</td>' +
    '</tr>'
  );
}

function buildPrintHVAC(){

  let html = '';

  selected()
    .forEach(method=>{

      const sr =
        methodResult(
          method,
          false
        );

      const factor =
        heatFactor(method);

      for(
        let i = 1;
        i <= count(method);
        i++
      ){

        const ac =
          typeFor(
            'ac',
            i
          );

        const heat =
          typeFor(
            'heat',
            i
          );

        if(
          sr.controller ===
            'cooling' ||
          sr.controller ===
            'both'
        ){

          html +=
            printRow(
              method ===
                'heatpump'
                ? (
                    'Heat Pump Compressor ' +
                    i
                  )
                : (
                    'Air Conditioning Unit ' +
                    i
                  ),

              qty(
                method,
                ac
              ),

              total(
                method,
                ac
              ),

              remaining(
                method,
                ac
              )
            );
        }

        if(
          sr.controller ===
            'heating' ||
          sr.controller ===
            'both'
        ){

          html +=
            printRow(
              (
                method ===
                  'heatpump'
                  ? 'Supplemental Electric Heat '
                  : (
                      method ===
                        'central65'
                        ? 'Central Electric Heat '
                        : 'Separately Controlled Electric Heat '
                    )
              ) +
              i +
              ' at ' +
              Math.round(
                factor * 100
              ) +
              '%',

              qty(
                method,
                heat
              ),

              total(
                method,
                heat
              ) *
              factor,

              remaining(
                method,
                heat
              ) *
              factor
            );
        }
      }
    });

  return html;
}

const priorPrint =
  window.updatePrintRows;

window.updatePrintRows =
  function(d){

    priorPrint(d);

    d.managedLoadCount =
      window
        .getCompleteManagedLoadCount();

    const report =
      document.getElementById(
        'printReport'
      );

    if(!report){
      return;
    }

    const summary =
      report.querySelector(
        '.print-method-details'
      );

    if(summary){

      const p =
        summary.querySelectorAll(
          '.summary-item span'
        );

      if(p[1]){

        p[1].textContent =
          String(
            d.managedLoadCount
          );
      }
    }

    const table =
      report.querySelector(
        '.print-table'
      );

    const tfoot =
      table &&
      table.querySelector(
        'tfoot'
      );

    if(tfoot){

      const rows =
        Array.from(
          tfoot.children
        );

      const start =
        rows.findIndex(
          r =>
            r.classList.contains(
              'print-section-row'
            ) &&
            r.textContent.trim() ===
              'HVAC Load'
        );

      if(start >= 0){

        let end =
          start + 1;

        while(
          end < rows.length &&
          !rows[end]
            .classList.contains(
              'print-section-row'
            ) &&
          !rows[end]
            .classList.contains(
              'final-total-row'
            )
        ){
          end++;
        }

        for(
          let i = end - 1;
          i > start;
          i--
        ){
          rows[i].remove();
        }

        const hv =
          buildPrintHVAC();

        if(hv){

          rows[start]
            .insertAdjacentHTML(
              'afterend',
              hv
            );

        }else{

          rows[start].remove();
        }
      }
    }

    const mc =
      document.getElementById(
        'bottomManagedLoadCount'
      );

    if(mc){

      mc.textContent =
        String(
          d.managedLoadCount
        );
    }

    syncManagedUI();
  };

function refresh(){

  clearInactiveManaged();

  updateOutputs();

  if(
    typeof calculate ===
    'function'
  ){
    calculate();
  }
}

const observer =
  new MutationObserver(
    () =>
      setTimeout(
        syncManagedUI,
        0
      )
  );

function init(){

  const v =
    document.querySelector(
      '.app-version'
    );

  if(v){

    v.textContent =
      'NEC 2023 | Version 2.0 — V5.41 Auto Save Restore Fixed';
  }

  const c =
    document.getElementById(
      'v57HvacMethodSections'
    );

  if(c){

    observer.observe(
      c,
      {
        childList:true,
        subtree:true
      }
    );
  }

  document.addEventListener(
    'input',
    () =>
      setTimeout(
        syncManagedUI,
        0
      )
  );

  document.addEventListener(
    'click',
    () =>
      setTimeout(
        syncManagedUI,
        20
      ),
    true
  );

  setTimeout(
    refresh,
    220
  );
}

if(
  document.readyState ===
  'loading'
){

  document.addEventListener(
    'DOMContentLoaded',
    init
  );

}else{

  init();
}

})();
(function(){

'use strict';

const METHODS_KEY =
  'loadcalcpro_hvac_selected_methods_v1';

const LEGACY_HP_KEY =
  'loadcalcpro_hvac_multi_hp_answer_v1';

const HP_SYSTEM_KEY =
  'loadcalcpro_hvac_heatpump_answers_v543';

const DATA_KEY =
  'loadcalcpro_hvac_method_sections_v57';

const MANAGED_KEY =
  'loadcalcpro_hvac_method_managed_v57';

const COUNT_KEY =
  'loadcalcpro_hvac_visible_system_counts_v522';

const BASE_MANAGED_ROWS = [
  10,11,12,13,14,15,16,17,18,19,
  20,21,22,23,24,25,26,27,28,29,
  30,42,43,47
];

const VALID = {
  central65:true,
  separate40:true,
  heatpump:true
};

function readJSON(
  k,
  f
){

  try{

    const v =
      JSON.parse(
        localStorage.getItem(k) ||
        ''
      );

    return (
      v &&
      typeof v === 'object'
    )
      ? v
      : f;

  }catch(e){

    return f;
  }
}

function writeJSON(
  k,
  v
){

  try{

    localStorage.setItem(
      k,
      JSON.stringify(v)
    );

  }catch(e){}
}

function selected(){

  const a =
    readJSON(
      METHODS_KEY,
      []
    );

  return Array.isArray(a)
    ? a.filter(
        m => VALID[m]
      )
    : [];
}

function dataset(){

  return readJSON(
    DATA_KEY,
    {}
  );
}

function managedMap(){

  return readJSON(
    MANAGED_KEY,
    {}
  );
}

function counts(){

  return readJSON(
    COUNT_KEY,
    {}
  );
}

function count(method){

  const n =
    Math.floor(
      Number(
        counts()[method]
      ) || 1
    );

  return Math.max(
    1,
    Math.min(
      3,
      n
    )
  );
}

function typeFor(
  kind,
  index
){

  return (
    kind +
    (
      index === 1
        ? ''
        : index
    )
  );
}

function key(
  method,
  type
){

  return (
    method +
    '_' +
    type
  );
}

function item(
  method,
  type
){

  return (
    dataset()[
      key(
        method,
        type
      )
    ] || {}
  );
}

function qty(
  method,
  type
){

  return Math.max(
    0,
    Math.floor(
      Number(
        item(
          method,
          type
        ).qty
      ) || 0
    )
  );
}

function va(
  method,
  type
){

  return Math.max(
    0,
    Number(
      item(
        method,
        type
      ).va
    ) || 0
  );
}

function total(
  method,
  type
){

  return (
    qty(
      method,
      type
    ) *
    va(
      method,
      type
    )
  );
}

function managedQty(
  method,
  type
){

  const q =
    qty(
      method,
      type
    );

  const raw =
    managedMap()[
      key(
        method,
        type
      )
    ];

  let n =
    raw === true
      ? q
      : Math.floor(
          Number(raw) || 0
        );

  return Math.max(
    0,
    Math.min(
      q,
      n
    )
  );
}

function remaining(
  method,
  type
){

  return (
    Math.max(
      qty(
        method,
        type
      ) -
      managedQty(
        method,
        type
      ),
      0
    ) *
    va(
      method,
      type
    )
  );
}

function aggregate(
  method,
  kind,
  generator
){

  let n = 0;

  for(
    let i = 1;
    i <= count(method);
    i++
  ){

    n += (
      generator
        ? remaining
        : total
    )(
      method,
      typeFor(
        kind,
        i
      )
    );
  }

  return n;
}

function heatQty(method){

  let n = 0;

  for(
    let i = 1;
    i <= count(method);
    i++
  ){

    n += qty(
      method,
      typeFor(
        'heat',
        i
      )
    );
  }

  return n;
}

function heatFactor(method){

  return (
    method ===
    'separate40'
  )
    ? (
        heatQty(method) >= 4
          ? .40
          : .65
      )
    : .65;
}

function hpAnswers(){

  return readJSON(
    HP_SYSTEM_KEY,
    {}
  );
}

function saveHpAnswers(v){

  writeJSON(
    HP_SYSTEM_KEY,
    v
  );
}

function hpAnswer(index){

  const a =
    hpAnswers();

  return (
    a[
      String(index)
    ] || ''
  );
}

function migrateLegacyAnswer(){

  const a =
    hpAnswers();

  if(
    Object.keys(a).length
  ){
    return;
  }

  const old =
    localStorage.getItem(
      LEGACY_HP_KEY
    ) || '';

  if(
    old === 'yes' ||
    old === 'no'
  ){

    const next = {};

    for(
      let i = 1;
      i <= count(
        'heatpump'
      );
      i++
    ){

      next[
        String(i)
      ] = old;
    }

    saveHpAnswers(
      next
    );
  }
}

function trimHpAnswers(){

  const a =
    hpAnswers();

  const max =
    count(
      'heatpump'
    );

  let changed = false;

  Object.keys(a)
    .forEach(k=>{

      if(
        Number(k) >
        max
      ){

        delete a[k];

        changed = true;
      }
    });

  if(changed){

    saveHpAnswers(a);
  }
}

function keepLegacyCompatibility(){

  /*
    Older scripts still read one
    heat-pump answer.

    Keep them permissive so they
    cannot clear managed selections
    before the final V5.43 logic runs.
  */

  if(
    selected()
      .includes(
        'heatpump'
      )
  ){

    try{

      localStorage.setItem(
        LEGACY_HP_KEY,
        'yes'
      );

    }catch(e){}
  }
}

function fmt(n){

  return n
    ? Math.round(n)
        .toLocaleString(
          'en-US'
        )
    : '';
}

function setText(
  sel,
  v
){

  const e =
    document.querySelector(
      sel
    );

  if(e){
    e.textContent = v;
  }
}

function normalMethodResult(
  method,
  generator
){

  const factor =
    heatFactor(method);

  const c =
    aggregate(
      method,
      'ac',
      generator
    );

  const h =
    aggregate(
      method,
      'heat',
      generator
    ) *
    factor;

  return c >= h
    ? {
        total:c,
        c:c,
        h:0,
        controller:'cooling'
      }
    : {
        total:h,
        c:0,
        h:h,
        controller:'heating'
      };
}

function heatPumpSystemResult(
  index,
  generator
){

  const ac =
    typeFor(
      'ac',
      index
    );

  const heat =
    typeFor(
      'heat',
      index
    );

  const c =
    (
      generator
        ? remaining
        : total
    )(
      'heatpump',
      ac
    );

  const h =
    (
      generator
        ? remaining
        : total
    )(
      'heatpump',
      heat
    ) * .65;

  const answer =
    hpAnswer(index);

  if(
    answer ===
    'yes'
  ){

    return {
      total:c + h,
      c:c,
      h:h,
      controller:'both',
      answer
    };
  }

  if(
    answer ===
    'no'
  ){

    return (
      total(
        'heatpump',
        ac
      ) >=
      total(
        'heatpump',
        heat
      ) * .65
    )
      ? {
          total:c,
          c:c,
          h:0,
          controller:'cooling',
          answer
        }
      : {
          total:h,
          c:0,
          h:h,
          controller:'heating',
          answer
        };
  }

  return {
    total:0,
    c:0,
    h:0,
    controller:'',
    answer:''
  };
}

function methodResult(
  method,
  generator
){

  if(
    method !==
    'heatpump'
  ){

    return normalMethodResult(
      method,
      generator
    );
  }

  let r = {
    total:0,
    c:0,
    h:0,
    controller:
      'per-system'
  };

  for(
    let i = 1;
    i <= count(
      'heatpump'
    );
    i++
  ){

    const x =
      heatPumpSystemResult(
        i,
        generator
      );

    r.total += x.total;
    r.c += x.c;
    r.h += x.h;
  }

  return r;
}

function controllerFor(
  method,
  index
){

  if(
    method ===
    'heatpump'
  ){

    return heatPumpSystemResult(
      index,
      false
    ).controller;
  }

  return normalMethodResult(
    method,
    false
  ).controller;
}

function comparisonReady(
  method,
  index
){

  if(
    method ===
    'heatpump'
  ){

    const answer =
      hpAnswer(index);

    if(!answer){
      return false;
    }

    if(
      answer ===
      'yes'
    ){

      return (
        total(
          method,
          typeFor(
            'ac',
            index
          )
        ) > 0 ||
        total(
          method,
          typeFor(
            'heat',
            index
          )
        ) > 0
      );
    }

    return (
      total(
        method,
        typeFor(
          'ac',
          index
        )
      ) > 0 &&
      total(
        method,
        typeFor(
          'heat',
          index
        )
      ) > 0
    );
  }

  return (
    aggregate(
      method,
      'ac',
      false
    ) > 0 &&
    aggregate(
      method,
      'heat',
      false
    ) > 0
  );
}

function isActive(
  method,
  type
){

  const m =
    String(type)
      .match(
        /^(ac|heat)(\d*)$/
      );

  if(!m){
    return false;
  }

  const kind =
    m[1];

  const index =
    m[2]
      ? Number(m[2])
      : 1;

  const c =
    controllerFor(
      method,
      index
    );

  return (
    c === 'both' ||
    (
      c ===
        'cooling' &&
      kind ===
        'ac'
    ) ||
    (
      c ===
        'heating' &&
      kind ===
        'heat'
    )
  );
}

function clearInactiveManaged(){

  const m =
    managedMap();

  let changed = false;

  selected()
    .forEach(method=>{

      for(
        let i = 1;
        i <= count(method);
        i++
      ){

        if(
          !comparisonReady(
            method,
            i
          )
        ){
          continue;
        }

        for(
          const kind of [
            'ac',
            'heat'
          ]
        ){

          const t =
            typeFor(
              kind,
              i
            );

          const k =
            key(
              method,
              t
            );

          if(
            !isActive(
              method,
              t
            ) &&
            m[k]
          ){

            m[k] = 0;

            changed = true;
          }
        }
      }
    });

  if(changed){

    writeJSON(
      MANAGED_KEY,
      m
    );
  }
}

function syncManagedUI(){

  clearInactiveManaged();

  document
    .querySelectorAll(
      '[data-v522-managed]'
    )
    .forEach(btn=>{

      const k =
        btn.dataset
          .v522Managed || '';

      const p =
        k.split('_');

      const method =
        p.shift();

      const type =
        p.join('_');

      const mm =
        type.match(
          /^(ac|heat)(\d*)$/
        );

      const index =
        mm &&
        mm[2]
          ? Number(mm[2])
          : 1;

      const hasLoad =
        qty(
          method,
          type
        ) > 0 &&
        va(
          method,
          type
        ) > 0;

      const compared =
        comparisonReady(
          method,
          index
        );

      const controlling =
        !compared ||
        isActive(
          method,
          type
        );

      const answerReady =
        method !==
          'heatpump' ||
        !!hpAnswer(index);

      const usable =
        hasLoad &&
        controlling &&
        answerReady;

      const controls =
        btn.closest(
          '.v57-method-managed'
        );

      if(controls){

        controls.classList.remove(
          'v539-hide-noncontrolling-managed'
        );

        controls.removeAttribute(
          'aria-hidden'
        );
      }

      btn.disabled =
        !usable;

      btn.classList.toggle(
        'v535-managed-inactive',
        !usable
      );

      btn.setAttribute(
        'aria-disabled',
        usable
          ? 'false'
          : 'true'
      );

      const row =
        btn.closest(
          '.v57-method-row'
        );

      if(row){

        row.classList.remove(
          'v535-noncontrolling-row'
        );
      }

      const qb =
        document.querySelector(
          '[data-v522-managed-qty="' +
          k +
          '"]'
        );

      if(qb){

        qb.disabled =
          !usable;

        qb.classList.toggle(
          'v535-managed-inactive',
          !usable
        );
      }
    });
}

function questionHTML(index){

  const a =
    hpAnswer(index);

  return (
    '<div class="v543-hp-question" ' +
    'data-v543-hp-question="' +
    index +
    '">' +

    '<div class="v543-hp-question-title">' +
    'Can the heat-pump compressor and supplemental electric heat operate simultaneously?' +
    '</div>' +

    '<div class="v543-hp-options">' +

    '<button type="button" ' +
    'class="v543-hp-option ' +
    (
      a === 'yes'
        ? 'selected'
        : ''
    ) +
    '" ' +
    'data-v543-hp-index="' +
    index +
    '" ' +
    'data-v543-hp-answer="yes">' +

    '<span class="v543-hp-check">' +
    (
      a === 'yes'
        ? '✓'
        : ''
    ) +
    '</span>' +

    '<span>' +
    'Yes — compressor at 100% plus supplemental heat at 65%' +
    '</span>' +

    '</button>' +

    '<button type="button" ' +
    'class="v543-hp-option ' +
    (
      a === 'no'
        ? 'selected'
        : ''
    ) +
    '" ' +
    'data-v543-hp-index="' +
    index +
    '" ' +
    'data-v543-hp-answer="no">' +

    '<span class="v543-hp-check">' +
    (
      a === 'no'
        ? '✓'
        : ''
    ) +
    '</span>' +

    '<span>' +
    'No — controls lock out the compressor during supplemental heat' +
    '</span>' +

    '</button>' +

    '</div>' +

    '</div>'
  );
}

function patchUI(){

  migrateLegacyAnswer();

  trimHpAnswers();

  keepLegacyCompatibility();

  document
    .querySelectorAll(
      '.v522-add-system'
    )
    .forEach(b=>{

      b.textContent =
        '+ Add HVAC Section';
    });

  const card =
    document.querySelector(
      '[data-v522-card="heatpump"]'
    );

  if(card){

    Array.from(
      card.children
    )
    .forEach(ch=>{

      if(
        ch.classList &&
        ch.classList.contains(
          'v57-hp-question'
        )
      ){
        ch.remove();
      }
    });

    const groups =
      card.querySelectorAll(
        '.v522-system-group'
      );

    groups.forEach(
      (
        g,
        idx
      )=>{

        const i =
          idx + 1;

        let q =
          g.querySelector(
            '.v543-hp-question'
          );

        if(!q){

          g.insertAdjacentHTML(
            'beforeend',
            questionHTML(i)
          );

        }else if(
          q.dataset
            .v543HpQuestion !==
          String(i)
        ){

          q.remove();

          g.insertAdjacentHTML(
            'beforeend',
            questionHTML(i)
          );
        }
      }
    );

    card
      .querySelectorAll(
        '.v543-hp-option'
      )
      .forEach(b=>{

        if(
          b.dataset.v543Bound
        ){
          return;
        }

        b.dataset.v543Bound =
          '1';

        b.addEventListener(
          'click',
          ()=>{

            const i =
              String(
                b.dataset
                  .v543HpIndex
              );

            const v =
              b.dataset
                .v543HpAnswer;

            const a =
              hpAnswers();

            if(
              a[i] === v
            ){

              delete a[i];

            }else{

              a[i] = v;
            }

            saveHpAnswers(a);

            keepLegacyCompatibility();

            patchUI();

            if(
              typeof calculate ===
              'function'
            ){
              calculate();
            }

            setTimeout(
              ()=>{

                updateOutputs();

                syncManagedUI();
              },
              0
            );
          }
        );
      });
  }

  updateOutputs();

  syncManagedUI();
}

function updateOutputs(){

  selected()
    .forEach(method=>{

      const factor =
        heatFactor(method);

      if(
        method ===
        'heatpump'
      ){

        for(
          let i = 1;
          i <= count(method);
          i++
        ){

          const r =
            heatPumpSystemResult(
              i,
              false
            );

          const rg =
            heatPumpSystemResult(
              i,
              true
            );

          const ac =
            typeFor(
              'ac',
              i
            );

          const heat =
            typeFor(
              'heat',
              i
            );

          setText(
            '[data-v522-output="' +
            key(
              method,
              ac
            ) +
            '_service"]',
            fmt(r.c)
          );

          setText(
            '[data-v522-output="' +
            key(
              method,
              ac
            ) +
            '_generator"]',
            fmt(rg.c)
          );

          setText(
            '[data-v522-output="' +
            key(
              method,
              heat
            ) +
            '_service"]',
            fmt(r.h)
          );

          setText(
            '[data-v522-output="' +
            key(
              method,
              heat
            ) +
            '_generator"]',
            fmt(rg.h)
          );
        }

      }else{

        const s =
          normalMethodResult(
            method,
            false
          );

        const g =
          normalMethodResult(
            method,
            true
          );

        const activeAC =
          s.controller ===
          'cooling';

        const activeHeat =
          s.controller ===
          'heating';

        for(
          let i = 1;
          i <= count(method);
          i++
        ){

          const ac =
            typeFor(
              'ac',
              i
            );

          const heat =
            typeFor(
              'heat',
              i
            );

          setText(
            '[data-v522-output="' +
            key(
              method,
              ac
            ) +
            '_service"]',
            fmt(
              activeAC
                ? total(
                    method,
                    ac
                  )
                : 0
            )
          );

          setText(
            '[data-v522-output="' +
            key(
              method,
              ac
            ) +
            '_generator"]',
            fmt(
              activeAC
                ? remaining(
                    method,
                    ac
                  )
                : 0
            )
          );

          setText(
            '[data-v522-output="' +
            key(
              method,
              heat
            ) +
            '_service"]',
            fmt(
              activeHeat
                ? total(
                    method,
                    heat
                  ) *
                  factor
                : 0
            )
          );

          setText(
            '[data-v522-output="' +
            key(
              method,
              heat
            ) +
            '_generator"]',
            fmt(
              activeHeat
                ? remaining(
                    method,
                    heat
                  ) *
                  factor
                : 0
            )
          );

          if(
            method ===
            'separate40'
          ){

            setText(
              '[data-v522-forty="' +
              i +
              '_service"]',
              heatQty(method) >= 4
                ? fmt(
                    total(
                      method,
                      heat
                    ) *
                    .40
                  )
                : ''
            );

            setText(
              '[data-v522-forty="' +
              i +
              '_generator"]',
              heatQty(method) >= 4 &&
              activeHeat
                ? fmt(
                    remaining(
                      method,
                      heat
                    ) *
                    .40
                  )
                : ''
            );

            setText(
              '[data-v522-forty-note="' +
              i +
              '"]',
              heatQty(method) >= 4
                ? 'Calculated automatically'
                : '65% applied — fewer than 4 total heating units'
            );
          }
        }

        if(
          method ===
          'separate40'
        ){

          const c =
            aggregate(
              method,
              'ac',
              false
            );

          const h =
            aggregate(
              method,
              'heat',
              false
            ) *
            factor;

          const used =
            Math.max(
              c,
              h
            );

          setText(
            '[data-v522-compare="qty"]',
            String(
              heatQty(method)
            )
          );

          setText(
            '[data-v522-compare="cooling"]',
            fmt(c)
          );

          setText(
            '[data-v522-compare="heating-used"]',
            fmt(h)
          );

          const label =
            document.querySelector(
              '[data-v522-heat-label]'
            );

          if(label){

            label.textContent =
              heatQty(method) >= 4
                ? 'Heating at 40%'
                : 'Heating at 65%';
          }

          setText(
            '[data-v522-compare="used"]',
            fmt(used) +
            (
              h > c
                ? ' — Heating'
                : ' — Cooling'
            )
          );
        }
      }
    });
}

window.hvacLoadCalculation =
  function(){

    clearInactiveManaged();

    let service = 0;

    let generator = 0;

    let serviceAC = 0;

    let generatorAC = 0;

    let serviceHeating = 0;

    let generatorHeating = 0;

    selected()
      .forEach(method=>{

        const s =
          methodResult(
            method,
            false
          );

        const g =
          methodResult(
            method,
            true
          );

        service += s.total;

        generator += g.total;

        serviceAC += s.c;

        serviceHeating += s.h;

        generatorAC += g.c;

        generatorHeating += g.h;
      });

    setOutput(
      'e37',
      serviceAC
    );

    setOutput(
      'e38',
      serviceHeating
    );

    setOutput('e39',0);
    setOutput('e40',0);
    setOutput('e41',0);

    setOutput(
      'f37',
      generatorAC
    );

    setOutput(
      'f38',
      generatorHeating
    );

    setOutput('f39',0);
    setOutput('f40',0);
    setOutput('f41',0);

    updateOutputs();

    syncManagedUI();

    return {
      service,
      generator,
      serviceAC,
      generatorAC,
      serviceHeating,
      generatorHeating,
      method:
        selected().join(','),
      multipleHeatTypes:
        selected().length > 1
    };
  };

window.validateHVACMethodSelection =
  function(){

    const sel =
      selected();

    let hpReady = true;

    if(
      sel.includes(
        'heatpump'
      )
    ){

      for(
        let i = 1;
        i <= count(
          'heatpump'
        );
        i++
      ){

        if(
          !hpAnswer(i)
        ){
          hpReady = false;
        }
      }
    }

    return {
      valid:
        sel.length > 0 &&
        hpReady,

      method:
        sel.join(','),

      methodSelected:
        sel.length > 0,

      heatPumpReady:
        hpReady,

      fortyPercentReady:
        true,

      heatingUnitCount:
        heatQty(
          'separate40'
        )
    };
  };

window.getHVACMethodSummary =
  function(){

    const names = {

      central65:
        'Central electric heat at 65%',

      separate40:
        (
          heatQty(
            'separate40'
          ) >= 4
            ? 'Separately controlled electric heat at 40%'
            : 'Separately controlled electric heat at 65% — fewer than four units'
        ),

      heatpump:
        'Heat pump with supplemental electric heat'
    };

    const sel =
      selected();

    return sel.length
      ? (
          'Heating method: ' +
          sel
            .map(
              m => names[m]
            )
            .join(' + ')
        )
      : 'Not selected';
  };

window.getCompleteManagedLoadCount =
  function(){

    let n = 0;

    BASE_MANAGED_ROWS
      .forEach(r=>{

        const q =
          typeof positiveQuantity ===
            'function'
            ? positiveQuantity(
                'q' + r
              )
            : 0;

        if(
          q > 0 &&
          typeof managedQuantity ===
            'function'
        ){

          n += Math.min(
            q,
            managedQuantity(r)
          );
        }
      });

    selected()
      .forEach(method=>{

        for(
          let i = 1;
          i <= count(method);
          i++
        ){

          for(
            const kind of [
              'ac',
              'heat'
            ]
          ){

            const t =
              typeFor(
                kind,
                i
              );

            if(
              isActive(
                method,
                t
              )
            ){

              n += managedQty(
                method,
                t
              );
            }
          }
        }
      });

    return n;
  };

window.applicableManagedLoadCount =
  window.getCompleteManagedLoadCount;

function escape(s){

  return String(s)
    .replace(
      /[&<>"']/g,
      ch => ({
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        '"':'&quot;',
        "'":'&#39;'
      }[ch])
    );
}

function printRow(
  label,
  q,
  s,
  g
){

  if(
    s <= 0 &&
    g <= 0
  ){
    return '';
  }

  return (
    '<tr>' +
    '<td>' +
    escape(label) +
    '</td>' +
    '<td class="quantity">' +
    (q || '') +
    '</td>' +
    '<td class="number">' +
    fmt(s) +
    '</td>' +
    '<td class="number">' +
    fmt(g) +
    '</td>' +
    '</tr>'
  );
}

function buildPrintHVAC(){

  let html = '';

  selected()
    .forEach(method=>{

      const factor =
        heatFactor(method);

      if(
        method ===
        'heatpump'
      ){

        for(
          let i = 1;
          i <= count(method);
          i++
        ){

          const s =
            heatPumpSystemResult(
              i,
              false
            );

          const g =
            heatPumpSystemResult(
              i,
              true
            );

          const ac =
            typeFor(
              'ac',
              i
            );

          const heat =
            typeFor(
              'heat',
              i
            );

          if(
            s.c > 0 ||
            g.c > 0
          ){

            html +=
              printRow(
                'Heat Pump Compressor ' +
                i,
                qty(
                  method,
                  ac
                ),
                s.c,
                g.c
              );
          }

          if(
            s.h > 0 ||
            g.h > 0
          ){

            html +=
              printRow(
                'Supplemental Electric Heat ' +
                i +
                ' at 65%',
                qty(
                  method,
                  heat
                ),
                s.h,
                g.h
              );
          }
        }

      }else{

        const s =
          normalMethodResult(
            method,
            false
          );

        const g =
          normalMethodResult(
            method,
            true
          );

        for(
          let i = 1;
          i <= count(method);
          i++
        ){

          const ac =
            typeFor(
              'ac',
              i
            );

          const heat =
            typeFor(
              'heat',
              i
            );

          if(
            s.controller ===
            'cooling'
          ){

            html +=
              printRow(
                'Air Conditioning Unit ' +
                i,
                qty(
                  method,
                  ac
                ),
                total(
                  method,
                  ac
                ),
                g.controller ===
                  'cooling'
                  ? remaining(
                      method,
                      ac
                    )
                  : 0
              );
          }

          if(
            s.controller ===
            'heating'
          ){

            html +=
              printRow(
                (
                  method ===
                    'central65'
                    ? 'Central Electric Heat '
                    : 'Separately Controlled Electric Heat '
                ) +
                i +
                ' at ' +
                Math.round(
                  factor * 100
                ) +
                '%',

                qty(
                  method,
                  heat
                ),

                total(
                  method,
                  heat
                ) *
                factor,

                g.controller ===
                  'heating'
                  ? remaining(
                      method,
                      heat
                    ) *
                    factor
                  : 0
              );
          }
        }
      }
    });

  return html;
}

const priorPrint543 =
  window.updatePrintRows;

window.updatePrintRows =
  function(d){

    priorPrint543(d);

    d.managedLoadCount =
      window
        .getCompleteManagedLoadCount();

    const report =
      document.getElementById(
        'printReport'
      );

    if(!report){
      return;
    }

    const table =
      report.querySelector(
        '.print-table'
      );

    const tfoot =
      table &&
      table.querySelector(
        'tfoot'
      );

    if(tfoot){

      const rows =
        Array.from(
          tfoot.children
        );

      const start =
        rows.findIndex(
          r =>
            r.classList.contains(
              'print-section-row'
            ) &&
            r.textContent.trim() ===
              'HVAC Load'
        );

      if(start >= 0){

        let end =
          start + 1;

        while(
          end < rows.length &&
          !rows[end]
            .classList.contains(
              'print-section-row'
            ) &&
          !rows[end]
            .classList.contains(
              'final-total-row'
            )
        ){
          end++;
        }

        for(
          let i = end - 1;
          i > start;
          i--
        ){
          rows[i].remove();
        }

        const hv =
          buildPrintHVAC();

        if(hv){

          rows[start]
            .insertAdjacentHTML(
              'afterend',
              hv
            );

        }else{

          rows[start].remove();
        }
      }
    }

    const mc =
      document.getElementById(
        'bottomManagedLoadCount'
      );

    if(mc){

      mc.textContent =
        String(
          d.managedLoadCount
        );
    }
  };

const oldReset543 =
  window.resetHeatingMethodSelection;

window.resetHeatingMethodSelection =
  function(){

    try{

      localStorage.removeItem(
        HP_SYSTEM_KEY
      );

    }catch(e){}

    if(
      typeof oldReset543 ===
      'function'
    ){

      oldReset543();
    }
  };

const observer =
  new MutationObserver(
    () =>
      setTimeout(
        patchUI,
        0
      )
  );

function init(){

  const v =
    document.querySelector(
      '.app-version'
    );

  if(v){

    v.textContent =
      'NEC 2023 | Version 2.0 — V5.43 HVAC Section Questions & Polish';
  }

  migrateLegacyAnswer();

  keepLegacyCompatibility();

  const c =
    document.getElementById(
      'v57HvacMethodSections'
    );

  if(c){

    observer.observe(
      c,
      {
        childList:true,
        subtree:true
      }
    );
  }

  document.addEventListener(
    'input',
    () =>
      setTimeout(
        ()=>{

          updateOutputs();

          syncManagedUI();
        },
        20
      )
  );

  document.addEventListener(
    'click',
    () =>
      setTimeout(
        ()=>{

          patchUI();

          syncManagedUI();
        },
        60
      ),
    true
  );

  setTimeout(
    ()=>{

      patchUI();

      if(
        typeof calculate ===
        'function'
      ){
        calculate();
      }
    },
    300
  );
}

if(
  document.readyState ===
  'loading'
){

  document.addEventListener(
    'DOMContentLoaded',
    init
  );

}else{

  init();
}

})();
(function(){

'use strict';

function relocateHeatPumpControls(){

  const card =
    document.querySelector(
      '[data-v522-card="heatpump"]'
    );

  if(!card){
    return;
  }

  const controls =
    card.querySelector(
      '.v523-system-controls'
    );

  if(!controls){
    return;
  }

  const groups =
    card.querySelectorAll(
      '.v522-system-group'
    );

  if(!groups.length){
    return;
  }

  const lastGroup =
    groups[
      groups.length - 1
    ];

  /*
    Keep the existing control unchanged;
    simply place it after the Yes/No
    question that belongs to the current
    last heat-pump section.
  */

  if(
    lastGroup.nextElementSibling !==
    controls
  ){

    lastGroup.insertAdjacentElement(
      'afterend',
      controls
    );
  }
}

const observer =
  new MutationObserver(
    () =>
      setTimeout(
        relocateHeatPumpControls,
        0
      )
  );

function init(){

  const v =
    document.querySelector(
      '.app-version'
    );

  if(v){

    v.textContent =
      'NEC 2023 | Version 2.0 — V5.44 Heat Pump Add Section Relocated';
  }

  const c =
    document.getElementById(
      'v57HvacMethodSections'
    );

  if(c){

    observer.observe(
      c,
      {
        childList:true,
        subtree:true
      }
    );
  }

  document.addEventListener(
    'click',
    () =>
      setTimeout(
        relocateHeatPumpControls,
        80
      ),
    true
  );

  setTimeout(
    relocateHeatPumpControls,
    350
  );
}

if(
  document.readyState ===
  'loading'
){

  document.addEventListener(
    'DOMContentLoaded',
    init
  );

}else{

  init();
}

})();
