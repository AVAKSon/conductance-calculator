document.getElementById('csvInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('http://localhost:8000/upload', {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();

  if (!data.columns || !data.data || data.data.length === 0) {
    document.getElementById('tableContainer').textContent = 'No data to display';
    return;
  }

  // Extract relevant columns
  const chamberIndexes = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20]; // 0=B, 1=C, 2=I, etc.
const rowLabelCol = data.columns[1]; // Column B (index 1) is the label column

const colMap = {};
const chambers = [];

chamberIndexes.forEach((colIdx, i) => {
  const name = `Chamber ${i + 1}`;
  const colName = data.columns[colIdx];
  chambers.push(name);
  colMap[name] = colName;
});
// Generate buttons
const buttonContainer = document.getElementById('chamberButtons');
buttonContainer.innerHTML = '';

chambers.forEach(chamber => {
  const btn = document.createElement('button');
  btn.textContent = chamber;
  btn.style.marginRight = '10px';
  btn.style.padding = '8px 12px';
  btn.style.cursor = 'pointer';
  btn.onclick = () => showChamberTable(chamber, data.data, rowLabelCol, colMap[chamber]);
  buttonContainer.appendChild(btn);
});

// Auto-load first chamber
showChamberTable(chambers[0], data.data, rowLabelCol, colMap[chambers[0]]);

});

// function showChamberTable(chamber, fullData, labelCol, valueCol) {
//   const container = document.getElementById('tableContainer');
//   container.innerHTML = ''; // Clear existing table

//   const title = document.createElement('h2');
//   title.textContent = `Chamber ${chamber}`;
//   container.appendChild(title);

//   const numRowsPerComponent = 9;
//   const startRow = 7; // Row 9 = index 7

//   // Only consider rows starting from C9
//   const trimmedRows = fullData.slice(startRow);

//   // Filter rows that have label + value
//   const validRows = trimmedRows.filter(row => row[labelCol] && row[valueCol] != null);

//   // First 9 labels define the structure of a component
//   const labels = validRows.slice(0, numRowsPerComponent).map(row => row[labelCol]);

//   // Group every 9 rows into one component (including incomplete)
//   const components = [];
//   for (let i = 0; i < validRows.length; i += numRowsPerComponent) {
//     const group = validRows.slice(i, i + numRowsPerComponent);
//     if (group.length === 0) continue;

//     const component = { Component: `Reducer ${components.length + 1}` };

//     for (let j = 0; j < labels.length; j++) {
//       const label = labels[j];
//       // If this label exists in the group, extract its value
//       component[label] = group[j]?.[valueCol] ?? '';
//     }

//     components.push(component);
//   }

//   // Build the table
//   const table = document.createElement('table');
//   table.style.borderCollapse = 'collapse';
//   table.style.width = '100%';

//   const thead = document.createElement('thead');
//   const headerRow = document.createElement('tr');

//   const allHeaders = ['Component', ...labels];
//   allHeaders.forEach(header => {
//     const th = document.createElement('th');
//     th.textContent = header;
//     th.style.border = '1px solid #ccc';
//     th.style.padding = '8px';
//     th.style.backgroundColor = '#f2f2f2';
//     headerRow.appendChild(th);
//   });
//   thead.appendChild(headerRow);
//   table.appendChild(thead);

//   const tbody = document.createElement('tbody');
//   components.forEach(comp => {
//     const tr = document.createElement('tr');
//     allHeaders.forEach(header => {
//       const td = document.createElement('td');
//       td.textContent = comp[header] ?? '';
//       td.style.border = '1px solid #ccc';
//       td.style.padding = '8px';
//       tr.appendChild(td);
//     });
//     tbody.appendChild(tr);
//   });
//   table.appendChild(tbody);

//   container.appendChild(table);
// }

function showChamberTable(chamber, fullData, labelCol, valueCol) {
  const container = document.getElementById('tableContainer');
  container.innerHTML = ''; // Clear previous table

  const title = document.createElement('h2');
  title.textContent = `${chamber}`;
  container.appendChild(title);

  const rows = []; // this will store final formatted rows

  // Helper to get cell value safely
  const get = (rowIdx) => fullData[rowIdx]?.[valueCol] ?? '';

  // Reducer1 前 배관
  rows.push({
    part: 'Reducer1 before',
    data:`
    <div style="display: flex; flex-direction: column; gap: 4px;">
      <div>
        <label>Diameter:</label>
        <input type="text" value="${get(7)}" data-key="diameter" style="margin-left: 10px;" />
      </div>
      <div>
        <label>Length:</label>
        <input type="text" value="${get(8)}" data-key="length" style="margin-left: 23px;" />
      </div>
    </div>
  `,
    conductance: ''
  });

  // Reducer1 前 Elbows (C13 = row 12)
  const reducer1ElbowCount = parseInt(get(11));
  if (!isNaN(reducer1ElbowCount) && reducer1ElbowCount > 0) {
    for (let i = 1; i <= reducer1ElbowCount; i++) {
      rows.push({
        part: `Reducer1 before Elbow ${i}`,
        data:`
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <div>
            <label>Diameter:</label>
            <input type="text" value="${get(10)}" data-key="diameter" style="margin-left: 10px;" />
          </div>
          <div>
            <label>Angle:</label>
            <input type="text" value="${get(12)}" data-key="angle" style="margin-left: 23px;" />
          </div>
        </div>
      `,
        conductance: ''
      });
    }
  }

  // Reducer1 Core (expander)
  rows.push({
    part: 'Reducer1 Core (expander)',
    data:`
    <div style="display: flex; flex-direction: column; gap: 4px;">
      <div>
        <label>Diameter 1:</label>
        <input type="text" value="${get(13)}" data-key="diameter1" style="margin-left: 10px;" />
      </div>
      <div>
        <label>Diameter 2:</label>
        <input type="text" value="${get(14)}" data-key="diameter2" style="margin-left: 23px;" />
      </div>
      <div>
        <label>Length:</label>
        <input type="text" value="${get(15)}" data-key="length" style="margin-left: 23px;" />
      </div>
    </div>
  `,
    conductance: ''
  });

  // Reducer2 前 배관
  rows.push({
    part: 'Reducer2 before',
    data:`
    <div style="display: flex; flex-direction: column; gap: 4px;">
      <div>
        <label>Diameter:</label>
        <input type="text" value="${get(16)}" data-key="diameter" style="margin-left: 10px;" />
      </div>
      <div>
        <label>Length:</label>
        <input type="text" value="${get(17)}" data-key="length" style="margin-left: 23px;" />
      </div>
    </div>
  `,
    conductance: ''
  });

  // Reducer2 前 Elbows (C22 = row 21)
  const reducer2ElbowCount = parseInt(get(20));
  if (!isNaN(reducer2ElbowCount) && reducer2ElbowCount > 0) {
    for (let i = 1; i <= reducer2ElbowCount; i++) {
      rows.push({
        part: `Reducer2 before Elbow ${i}`,
        data:`
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <div>
            <label>Diameter:</label>
            <input type="text" value="${get(19)}" data-key="diameter" style="margin-left: 10px;" />
          </div>
          <div>
            <label>Angle:</label>
            <input type="text" value="${get(21)}" data-key="angle" style="margin-left: 23px;" />
          </div>
        </div>
      `,
        conductance: ''
      });
    }
  }

  // Reducer2 Core (expander) — check if C24 (row 23) has data
  if (get(22)) {
    rows.push({
      part: 'Reducer2 Core (expander)',
      data:`
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <div>
          <label>Diameter 1:</label>
          <input type="text" value="${get(22)}" data-key="diameter1" style="margin-left: 10px;" />
        </div>
        <div>
          <label>Diameter 2:</label>
          <input type="text" value="${get(23)}" data-key="diameter2" style="margin-left: 23px;" />
        </div>
        <div>
          <label>Length:</label>
          <input type="text" value="${get(24)}" data-key="length" style="margin-left: 23px;" />
        </div>
      </div>
    `,
      conductance: ''
    });
  }

  // Reducer2 後 배관
  if (get(25)) {
    rows.push({
      part: 'Reducer2 after',
      data:`
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <div>
          <label>Diameter:</label>
          <input type="text" value="${get(25)}" data-key="diameter" style="margin-left: 10px;" />
        </div>
        <div>
          <label>Length:</label>
          <input type="text" value="${get(26)}" data-key="length" style="margin-left: 23px;" />
        </div>
      </div>
    `,
      conductance: ''
    });
  }

  // Reducer2 後 Elbows (C31 = row 30)
  const reducer2BackElbowCount = parseInt(get(29));
  if (!isNaN(reducer2BackElbowCount) && reducer2BackElbowCount > 0) {
    for (let i = 1; i <= reducer2BackElbowCount; i++) {
      rows.push({
        part: `Reducer2 after Elbow ${i}`,
        data:`
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <div>
            <label>Diameter:</label>
            <input type="text" value="${get(28)}" data-key="diameter" style="margin-left: 10px;" />
          </div>
          <div>
            <label>Angle:</label>
            <input type="text" value="${get(30)}" data-key="angle" style="margin-left: 23px;" />
          </div>
        </div>
      `,
        conductance: ''
      });
    }
  }

  // Render table
  const table = document.createElement('table');
  table.style.borderCollapse = 'collapse';
  table.style.width = '100%';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['Part Name', 'Data', 'Conductance'].forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    th.style.border = '1px solid #ccc';
    th.style.padding = '8px';
    th.style.backgroundColor = '#f2f2f2';
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  rows.forEach(row => {
    const tr = document.createElement('tr');
    ['part', 'data', 'conductance'].forEach(key => {
      const td = document.createElement('td');
      if (key === 'data') {
        td.innerHTML = row[key];  // Use innerHTML to support line breaks
      } else {
        td.textContent = row[key];
      }
      td.style.border = '1px solid #ccc';
      td.style.padding = '8px';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  
  table.appendChild(tbody);

  container.appendChild(table);
}
