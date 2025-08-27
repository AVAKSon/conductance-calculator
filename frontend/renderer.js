function showPage(pageId) {
  document.querySelectorAll('.tab-content').forEach(div => {
    div.classList.remove('active');
  });
  document.getElementById(pageId).classList.add('active');
}

// drag n drop import
document.addEventListener('dragover', (e) => {
  e.preventDefault(); // Prevent default to allow drop
  e.dataTransfer.dropEffect = 'copy';
});

document.addEventListener('drop', async (e) => {
  e.preventDefault();

  const file = e.dataTransfer.files[0];
  if (!file) return;

  console.log('File dropped:', file.name);

  const formData = new FormData();
  formData.append('file', file);

  // Reuse the same upload logic
  const res = await fetch('http://localhost:8000/upload', {
    method: 'POST',
    body: formData
  });

  const data = await res.json();

  // Reuse your existing rendering functions
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




function renderUploadedData(data) {
  const output = document.getElementById('chamberButtons');
  output.innerHTML = '';

  const allCols = data.columns;
  const columns = [];
  for (let i = 2; i < allCols.length; i++) columns.push(allCols[i]);

  const rowNames = data.data.map(row => Object.values(row)[0]);

  // Render metadata
  const metadataDiv = document.getElementById('fileInfo');
  const metadataTable = data.data.slice(1, 5);
  let metadataRows = [
    { label: 'FAB', value: Object.values(metadataTable[0])[2] ?? '' },
    { label: 'DAREA', value: 'DAREA' },
    { label: '장비 ID', value: Object.values(metadataTable[3])[2] ?? '' },
    { label: 'Model', value: Object.values(metadataTable[2])[2] ?? '' },
    { label: '모델관리기준', value: '모델관리기준' },
    { label: 'Min Spec', value: 'Min Spec' },
    { label: 'Max Spec', value: 'Max Spec' }
  ];

  let metadataHtml = '';
  metadataRows.forEach(row => {
    metadataHtml += `
      <div class="metadata-label">${row.label}:</div>
      <div class="metadata-value">${row.value}</div>
    `;
  });
  metadataDiv.innerHTML = metadataHtml;

  // Render chamber buttons
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
}



function renderChamberTable(colName, rows, chamberIndex) {
  const chamberTable = document.getElementById('chamberTable');

  const partLabels = [
    'FAB',
    'MAKER',
    '모델',
    '장비 ID',
    'Chamber',
    'CODE',
    'Reducer1 前 배관 직경[inch]',
    'Reducer1 前 배관 총장[mm]',
    'Reducer1 前 배관 총장[cm]',
    'Reducer1 前 Elbow 직경',
    'Reducer1 前 Elbow 개수',
    'Reducer1 前 Elbow 각도', //угол
    'Reducer1 前 Elbow 수량', //количество
    'Reducer1 입구 직경[IN]',
    'Reducer1 출구 직경[IN]',
    'Reducer1 길이[mm]',
    'Reducer2 前 배관 직경[inch]',
    'Reducer2 前 배관 총장[mm]',
    'Reducer2 前 배관 총장[cm]',
    'Reducer2 前 Elbow 직경',
    'Reducer2 前 Elbow 개수',
    'Reducer2 前 Elbow 각도', //угол
    'Reducer2 前 Elbow 수량', //количество
    'Reducer2 입구 직경[IN]',
    'Reducer2 출구 직경[IN]',
    'Reducer2 길이[mm]',
    'Reducer2 後 배관 직경[inch]',
    'Reducer2 後 배관 총장[mm]',
    'Reducer2 後 배관 총장[cm]',
    'Reducer2 後 Elbow 직경',
    'Reducer2 後 Elbow 개수',
    'Reducer2 後 Elbow 각도',  //угол
    'Reducer2 後 Elbow 수량'  //количество
  ];

  let html = '<div class="table-container">';
  html += '<table border="1" style="border-collapse: collapse;">';

  // First row: Part labels
  html += '<tr>';
  for (let i = 0; i < partLabels.length; i++) {
    html += `<th>${partLabels[i]}</th>`;
  }
  html += '</tr>';

  // Second row: Chamber data
  html += '<tr>';
  for (let i = 0; i < partLabels.length; i++) {
    const val = rows[i + 1]?.[colName] ?? '';
    html += `<td contenteditable="true" data-row="${i}" data-col="${colName}">${val ?? ''}</td>`;

  }
  html += '</tr>';
  

  html += '</table></div>';
  chamberTable.innerHTML = html;



  document.querySelectorAll('#chamberTable td[contenteditable="true"]').forEach(cell => {
    cell.addEventListener('blur', async (e) => {
      const newValue = e.target.innerText.trim();
      var rowIndex = e.target.getAttribute('data-row');
      const columnIndex = e.target.getAttribute('data-col')

      console.log(`Row ${rowIndex}`);

      rowIndex = parseInt(rowIndex);
      rowIndex = rowIndex + 1;

      console.log(`Row ${rowIndex}`);

      rows[rowIndex][columnIndex] = newValue;


      console.log(`Edited in Chamber ${chamberIndex} at row ${rowIndex}:`, newValue);

      // send update to backend
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