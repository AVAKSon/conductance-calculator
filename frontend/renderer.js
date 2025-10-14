function showPage(pageId) {
  document.querySelectorAll('.tab-content').forEach(div => {
    div.classList.remove('active');
  });
  document.getElementById(pageId).classList.add('active');
}

// drag n drop import
// document.addEventListener('dragover', (e) => {
//   e.preventDefault(); // Prevent default to allow drop
//   e.dataTransfer.dropEffect = 'copy';
// });

// document.addEventListener('drop', async (e) => {
//   e.preventDefault();

//   const file = e.dataTransfer.files[0];
//   if (!file) return;

//   console.log('File dropped:', file.name);

//   const formData = new FormData();
//   formData.append('file', file);

//   // Reuse the same upload logic
//   const res = await fetch('http://localhost:8000/upload', {
//     method: 'POST',
//     body: formData
//   });

//   const data = await res.json();

//   // Reuse your existing rendering functions
//   renderUploadedData(data);
// });

const dropZone = document.getElementById('dropZone');

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');

  const file = e.dataTransfer.files[0];
  if (!file) return;

  console.log('File dropped:', file.name);

  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('http://localhost:8000/upload', {
    method: 'POST',
    body: formData
  });

  const data = await res.json();
  document.getElementById("simulationResults").innerHTML = "";
  renderUploadedData(data);
});


// Old file input
document.getElementById('csvInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('http://localhost:8000/upload', {
    method: 'POST',
    body: formData
  });

  const data = await res.json();

  // Reuse the shared rendering function
  renderUploadedData(data);
});

async function fetchCurrentData() {
  try {
    const res = await fetch("http://localhost:8000/get-current-data");
    const json = await res.json();

    if (res.ok) {
      console.log("Current data from backend:", json);
      return json; // json.columns + json.data
    } else {
      console.warn(json.error || "Failed to fetch current data");
      return null;
    }
  } catch (err) {
    console.error("Error fetching current data:", err);
    return null;
  }
}


//Run Simulation button
// document.getElementById("runSimulationBtn").addEventListener("click", async () => {
//   const currentData = await fetchCurrentData();
//   if (!currentData) {
//     alert("No data available. Please import a file first.");
//     return;
//   }

//   // Use currentData.columns and currentData.data to render the new simulation table
//   renderSimulationTable(currentData.data, currentData.columns);
// });

document.getElementById("runSimulationBtn").addEventListener("click", async () => {
  // Fetch the current df_filtered from the backend
  const response = await fetch("http://localhost:8000/get-current-data");
  if (!response.ok) {
    alert("Failed to get current data.");
    return;
  }
  const currentData = await response.json();

  // Clear the old interface
  // document.getElementById("chamberButtons").innerHTML = "";
  // document.getElementById("chamberTable").innerHTML = "";

  document.getElementById('chamberButtons').style.display = 'none';
  document.getElementById('chamberTable').style.display = 'none';
  document.getElementById('importFileBtn').style.display = 'none';
  document.getElementById('runSimulationBtn').style.display = 'none';
  document.getElementById('backBtn').style.display = 'block';
  document.getElementById('simulationResults').style.display = 'block';


  // const buttonContainer = document.getElementById('buttonContainer');
  // buttonContainer.innerHTML = `
  //   <button id="backBtn">Back to File Input</button>
  // `;

  document.getElementById('backBtn').addEventListener('click', () => {
    console.log("Returning to file input...");
    document.getElementById('chamberButtons').style.display = 'flex';
    document.getElementById('chamberTable').style.display = 'block';
    document.getElementById('importFileBtn').style.display = 'block';
    document.getElementById('runSimulationBtn').style.display = 'block';
    document.getElementById('backBtn').style.display = 'none';
    document.getElementById('simulationResults').style.display = 'none';
  });

  // Render the simulation table
  renderSimulationTable(currentData.data, currentData.columns);
});

function renderSimulationTable(data, columns) {
  const container = document.getElementById("simulationResults");
  container.innerHTML = ""; // make sure it's empty
  console.log(data)

  // Example: one row per chamber
  const numChambers = columns.length - 2; // adjust for your indexing
  collectConductances(numChambers, columns, data).then(conductances => {
    console.log("All conductances:", conductances);
  
    let html = '<table border="1"><tr><th>Chamber</th><th>Total Conductance</th><th>Result</th></tr>';
    conductances.forEach((c, i) => {
      html += `<tr>
                 <td>Chamber ${i + 1}</td>
                 <td>${c !== null ? c : "-"}</td>
                 <td class="result-cell">IN</td>
               </tr>`;
    });
    html += "</table>";
  
    container.innerHTML = html;
  });
  
}

function collectConductances(numChambers, columns, data) {
  const conductances = new Array(numChambers);   // reserve slots
  const promises = [];

  for (let i = 0; i < numChambers; i++) {
    const chamberRequest = buildChamberRequest(columns[i+2], data, i+2);
    console.log("chamber ", i);
    console.log(chamberRequest);

    const p = fetch("http://localhost:8000/calculate_chamber", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(chamberRequest)
    })
      .then(res => res.json())
      .then(result => {
        conductances[i] = Math.round(result.total_conductance);  // store by index
      })
      .catch(err => {
        console.error("Error for chamber", i + 1, err);
        conductances[i] = null; // fallback
      });

    promises.push(p);
  }

  // return both the list and a promise that resolves when all are done
  return Promise.all(promises).then(() => conductances);
}


function buildChamberRequest(colName, rows, chamberIndex) {
  const chamberStructure = [
    { inlet: 7, length: 8, angle: null, outlet: null, quantity: "const" },   // pipe
    { inlet: 10, length: null, angle: 12, outlet: null, quantity: 11 },      // elbow
    { inlet: 14, length: 16, angle: null, outlet: 15, quantity: "const" },   // reducer/expander 1
    { inlet: 17, length: 18, angle: null, outlet: null, quantity: "const" }, // pipe
    { inlet: 20, length: null, angle: 22, outlet: null, quantity: 21 },      // elbow
    { inlet: 24, length: 26, angle: null, outlet: 25, quantity: "const" },   // reducer/expander 2
    { inlet: 27, length: 28, angle: null, outlet: null, quantity: "const" }, // pipe
    { inlet: 30, length: null, angle: 32, outlet: null, quantity: 31 },      // elbow
  ];

  const components = [];

  chamberStructure.forEach((part) => {
    const getVal = (idx) => (idx !== null && idx !== undefined) ? rows[idx]?.[colName] : "";
    let params = {};
    let type = "pipe"; // default

    if (part.length !== null || part.angle === null) {
      // Pipe
      const dia = parseFloat(getVal(part.inlet)) * 2.54;
      const length = parseFloat(getVal(part.length)) * 0.1;
      if (!isNaN(dia) && !isNaN(length)) {
        params = { Diameter_cm: dia, Length_cm: length };
        type = "pipe";
      }
    }

    if (part.angle !== null) {
      // Elbow
      const dia = parseFloat(getVal(part.inlet)) * 2.54;
      const angle = parseFloat(getVal(part.angle));
      if (!isNaN(dia) && !isNaN(angle)) {
        params = { Diameter_cm: dia, BendAngle_deg: angle };
        type = "elbow";
      }
    }

    if (part.outlet !== null) {
      // Reducer/Expander
      const d1 = parseFloat(getVal(part.inlet)) * 2.54;
      const d2 = parseFloat(getVal(part.outlet)) * 2.54;
      const length = parseFloat(getVal(part.length)) * 0.1;
      if (!isNaN(d1) && !isNaN(d2) && !isNaN(length)) {
        params = { D1_cm: d1, D2_cm: d2, Length_cm: length };
        type = d1 > d2 ? "reducer" : "expander";
      }
    }

    if (Object.keys(params).length > 0) {
      // Handle quantity
      let quantity = 1;
      if (part.quantity !== "const") {
        const qVal = parseInt(getVal(part.quantity));
        if (!isNaN(qVal) && qVal > 0) quantity = qVal;
      }

      for (let i = 0; i < quantity; i++) {
        components.push({ type, params });
      }
    }
  });

  return {
    chamber_id: `Chamber${chamberIndex + 1}`,
    code_id: rows[4]?.[colName] ?? `Code${chamberIndex + 1}`,
    pressure: 0.1,
    components
  };
}






function renderUploadedData(data) {
  const output = document.getElementById('chamberButtons');
  output.innerHTML = '';

  const allCols = data.columns;
  const columns = [];
  for (let i = 2; i < allCols.length; i++) columns.push(allCols[i]);

  // Render chamber buttons first
  columns.forEach((colName, index) => {
    const btn = document.createElement('button');
    btn.textContent = `Chamber ${index + 1}`;
    btn.classList.add('chamber-button');

    btn.onclick = () => {
      document.querySelectorAll('.chamber-button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderChamberTable(colName, data.data, index);
    };

    output.appendChild(btn);
  });

  // Show first chamber by default
  renderChamberTable(columns[0], data.data, 0);
  const firstButton = output.querySelector('.chamber-button');
  if (firstButton) firstButton.classList.add('active');
}


function renderChamberTable(colName, rows, chamberIndex) {
  const metadataDiv = document.getElementById('fileInfo');
  const metadataTable = rows.slice(1, 5);

  const equipmentId = String(Object.values(rows[4]?.[colName] ?? ''));
  let building = '';
  let FAB = '';
  if (equipmentId && equipmentId.length > 0) {
    const firstChar = equipmentId.charAt(0); // take first character
    building = `M1${firstChar}`;
    const fifthChar = equipmentId.charAt(8);
    console.log(equipmentId + " " + fifthChar)
    if (/[A-Za-z]/.test(fifthChar)) {
      FAB = building + 'B';
    } else if (/[0-9]/.test(fifthChar)) {
      FAB = building + 'A';
    }
  }

  let metadataRows = [
    { label: 'Building', value: building},
    { label: 'FAB', value: FAB},
    { label: 'DAREA', value: '-' },
    { label: '장비 ID', value: rows[4]?.[colName] ?? '' },
    { label: 'Model', value: rows[3]?.[colName] ?? '' },
    { label: '모델관리기준', value: '-' },
    { label: 'Min Spec', value: '-' },
    { label: 'Max Spec', value: '-' }
  ];

  let metadataHtml = '';
  metadataRows.forEach(row => {
    metadataHtml += `
      <div class="metadata-label">${row.label}:</div>
      <div class="metadata-value">${row.value}</div>
    `;
  });
  metadataDiv.innerHTML = metadataHtml;

  const chamberTable = document.getElementById('chamberTable');

  // Define mapping schema
  const chamberStructure = [
    { name: "pipe",      type: "Pipe",    inlet: 7,  length: 8, angle: null, outlet: null, quantity: "const" },
    { name: "elbow",     type: "Elbow",   inlet: 10, length: null, angle: 12, outlet: null, quantity: 11 },
    { name: "reducer 1", type: "Reducer", inlet: 14, length: 16, angle: null, outlet: 15, quantity: "const" },
    { name: "pipe",      type: "Pipe",    inlet: 17, length: 18, angle: null, outlet: null, quantity: "const" },
    { name: "elbow",     type: "Elbow",   inlet: 20, length: null, angle: 22, outlet: null, quantity: 21 },
    { name: "reducer 2", type: "Reducer", inlet: 24, length: 26, angle: null, outlet: 25, quantity: "const" },
    { name: "pipe",      type: "Pipe",    inlet: 27, length: 28, angle: null, outlet: null, quantity: "const" },
    { name: "elbow",     type: "Elbow",   inlet: 30, length: null, angle: 32, outlet: null, quantity: 31 },
  ];

  let html = '<div class="table-container">';
  html += '<table border="1" style="border-collapse: collapse;">';
  html += '<tr><th>No</th><th>Type</th><th>Inlet(inch)</th><th>Length(mm)</th><th>Angle(º)</th><th>Outlet(inch)</th><th>Quantity</th></tr>';

  let partIndex = 1;

  chamberStructure.forEach((part) => {
    // Grab values from df (rows array for this chamber column)
    const getVal = (rowIndex) => (rowIndex !== null && rowIndex !== undefined)
      ? (rows[rowIndex]?.[colName] ?? "")
      : "";
    const inletVal = getVal(part.inlet);
    const lengthVal = getVal(part.length);
    const angleVal = getVal(part.angle);
    const outletVal = getVal(part.outlet);
    const quantityVal = (part.quantity === "const") ? "1" : getVal(part.quantity);

    // Check only "real" values (ignore const quantity)
    const realVals = [inletVal, lengthVal, angleVal, outletVal];
    const hasData = realVals.some(v => v && v !== "");

    // Skip row if no real data
    if (!hasData) {
      return;
    }



    // Render row
    html += `<tr>
      <td>${partIndex++}</td>
      <td>${part.type}</td>
      <td contenteditable="true" data-row="${part.inlet}" data-col="${colName}">${inletVal}</td>
      <td contenteditable="true" data-row="${part.length}" data-col="${colName}">${lengthVal}</td>
      <td contenteditable="true" data-row="${part.angle}" data-col="${colName}">${angleVal}</td>
      <td contenteditable="true" data-row="${part.outlet}" data-col="${colName}">${outletVal}</td>
      <td contenteditable="true" data-row="${part.quantity === "const" ? "const" : part.quantity}" data-col="${colName}">${quantityVal}</td>
    </tr>`;
  });

  html += '</table></div>';
  chamberTable.innerHTML = html;

// After chamberTable.innerHTML = html;
const editableCells = chamberTable.querySelectorAll('td[contenteditable="true"]');

editableCells.forEach(cell => {
  cell.addEventListener('blur', async (e) => {
    const newValue = e.target.innerText.trim();
    const rowIndex = parseInt(e.target.dataset.row);
    const colName = e.target.dataset.col;

    // Update local in-memory data
    rows[rowIndex][colName] = newValue;

    console.log(`Edited Chamber ${chamberIndex} at row ${rowIndex}: ${newValue}`);

    // Send to backend
    await fetch('http://localhost:8000/update-cell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chamber: chamberIndex,
        row: rowIndex,
        value: newValue
      })
    });
  });
});
}
