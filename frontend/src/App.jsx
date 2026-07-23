import { useState, useEffect } from 'react'

const guessConfig = (fileInfo) => {
  const config = {
    forecast_sheet: fileInfo.forecast?.active_sheet || '',
    stock_sheet: fileInfo.stock?.active_sheet || '',
    backlog_sheet: fileInfo.backlog?.active_sheet || '',
    po_sheet: fileInfo.po?.active_sheet || '',
    forecast_part_col: '',
    forecast_months: [],
    stock_part_col: '',
    stock_qty_cols: [],
    backlog_part_col: '',
    backlog_qty_col: '',
    backlog_filter_col: '',
    backlog_filter_val: 'SWINGTEL',
    backlog_extra_cols: [],
    po_part_col: '',
    po_qty_col: '',
    po_remark_col: '',
    po_remark_filter: 'Not Loaded',
    po_status_col: '',
    po_date_col: ''
  };

  const findCol = (cols, candidates) => cols.find(c => candidates.includes(c)) || '';

  if (fileInfo.forecast && fileInfo.forecast.data[config.forecast_sheet]) {
    const cols = fileInfo.forecast.data[config.forecast_sheet].columns;
    config.forecast_part_col = findCol(cols, ['Mfr Catalogue No.', 'Part Number', 'Item Code']);
    config.forecast_months = cols.filter(c => c && c.length === 7 && /^\d{4} \d{2}$/.test(c)).slice(0, 4);
  }

  if (fileInfo.stock && fileInfo.stock.data[config.stock_sheet]) {
    const cols = fileInfo.stock.data[config.stock_sheet].columns;
    config.stock_part_col = findCol(cols, ['MPN', 'Item Code', 'Part Number']);
    config.stock_qty_cols = cols.filter(c => ['Sum of Stock in Hand', 'Stock in Hand', 'Sum of In Transit ', 'Sum of In Transit', 'In Transit'].includes(c));
  }

  if (fileInfo.backlog && fileInfo.backlog.data[config.backlog_sheet]) {
    const cols = fileInfo.backlog.data[config.backlog_sheet].columns;
    config.backlog_part_col = findCol(cols, ['品名\nPart number /description', '客戶料號\nCust P/N (CPN)', '料號\nmaterial#']);
    config.backlog_qty_col = findCol(cols, ['訂單未結量\nBalance/remaining Qty', 'Balance/remaining Qty', 'Balance Qty']);
    config.backlog_filter_col = findCol(cols, ['名稱\ncust name', 'cust name', 'Customer']);
  }

  if (fileInfo.po && fileInfo.po.data[config.po_sheet]) {
    const cols = fileInfo.po.data[config.po_sheet].columns;
    config.po_part_col = findCol(cols, ['Part No :', 'Part No', 'Part Number']);
    config.po_qty_col = findCol(cols, ['PO Qty. ', 'PO Qty']);
    config.po_remark_col = findCol(cols, ['Remark', 'Status']);
    config.po_status_col = cols[0] || '';
    config.po_date_col = findCol(cols, ['Swingtel Request Date\n (SRD)', 'SRD', 'Request Date']);
  }

  return config;
};

function App() {
  const [step, setStep] = useState(1);
  const [files, setFiles] = useState({ forecast: null, stock: null, backlog: null, po: null });
  const [fileInfo, setFileInfo] = useState(null);
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [previewColumns, setPreviewColumns] = useState([]);
  
  // Modal for previewing source files
  const [sourcePreview, setSourcePreview] = useState(null);

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      setFiles(prev => ({ ...prev, [type]: file }));
      setError(null);
    }
  };

  const handleParseFiles = async () => {
    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append('forecast_file', files.forecast);
    formData.append('stock_file', files.stock);
    formData.append('backlog_file', files.backlog);
    formData.append('po_file', files.po);

    try {
      const response = await fetch('/api/get_file_info', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error(await response.text());
      
      const data = await response.json();
      setFileInfo(data);
      setConfig(guessConfig(data));
      setStep(2);
    } catch (err) {
      setError("Failed to parse files: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigChange = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSheetChange = (type, sheetName) => {
    const newConfig = { ...config, [`${type}_sheet`]: sheetName };
    const cols = fileInfo[type].data[sheetName]?.columns || [];
    const findCol = (cols, candidates) => cols.find(c => candidates.includes(c)) || '';
    
    if (type === 'forecast') {
      newConfig.forecast_part_col = findCol(cols, ['Mfr Catalogue No.', 'Part Number', 'Item Code']);
      newConfig.forecast_months = cols.filter(c => c && c.length === 7 && /^\d{4} \d{2}$/.test(c)).slice(0, 4);
    } else if (type === 'stock') {
      newConfig.stock_part_col = findCol(cols, ['MPN', 'Item Code', 'Part Number']);
      newConfig.stock_qty_cols = cols.filter(c => ['Sum of Stock in Hand', 'Stock in Hand', 'Sum of In Transit ', 'Sum of In Transit', 'In Transit'].includes(c));
    } else if (type === 'backlog') {
      newConfig.backlog_part_col = findCol(cols, ['品名\nPart number /description', '客戶料號\nCust P/N (CPN)', '料號\nmaterial#']);
      newConfig.backlog_qty_col = findCol(cols, ['訂單未結量\nBalance/remaining Qty', 'Balance/remaining Qty', 'Balance Qty']);
      newConfig.backlog_filter_col = findCol(cols, ['名稱\ncust name', 'cust name', 'Customer']);
    } else if (type === 'po') {
      newConfig.po_part_col = findCol(cols, ['Part No :', 'Part No', 'Part Number']);
      newConfig.po_qty_col = findCol(cols, ['PO Qty. ', 'PO Qty']);
      newConfig.po_remark_col = findCol(cols, ['Remark', 'Status']);
      newConfig.po_status_col = cols[0] || '';
      newConfig.po_date_col = findCol(cols, ['Swingtel Request Date\n (SRD)', 'SRD', 'Request Date']);
    }
    setConfig(newConfig);
  };

  const handleGeneratePreview = async () => {
    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append('forecast_file', files.forecast);
    formData.append('stock_file', files.stock);
    formData.append('backlog_file', files.backlog);
    formData.append('po_file', files.po);
    formData.append('config', JSON.stringify(config));

    try {
      const response = await fetch('/api/generate_preview', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error(await response.text());

      const data = await response.json();
      setPreviewColumns(data.columns);
      setPreviewData(data.data);
      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    const formData = new FormData();
    formData.append('forecast_file', files.forecast);
    formData.append('stock_file', files.stock);
    formData.append('backlog_file', files.backlog);
    formData.append('po_file', files.po);
    formData.append('config', JSON.stringify(config));

    try {
      const response = await fetch('/api/generate_report', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Failed to download report');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Forecast_Report.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  };

  const allFilesUploaded = Object.values(files).every(f => f !== null);

  const FileCard = ({ title, type, icon }) => (
    <div className={`upload-card ${files[type] ? 'has-file' : ''}`}>
      <input type="file" className="file-input" accept=".xlsx,.xls" onChange={(e) => handleFileChange(e, type)} />
      <div className="upload-icon">{files[type] ? '✅' : icon}</div>
      <div className="upload-title">{title}</div>
      {files[type] && <div className="file-name">{files[type].name}</div>}
    </div>
  );

  const MultiSelect = ({ options, selected, onChange }) => {
    const toggle = (opt) => {
      if (selected.includes(opt)) onChange(selected.filter(x => x !== opt));
      else onChange([...selected, opt]);
    };
    return (
      <div className="multi-select">
        {options.map(opt => (
          <label key={opt} className={`pill ${selected.includes(opt) ? 'selected' : ''}`}>
            <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} />
            {opt}
          </label>
        ))}
      </div>
    );
  };

  const Select = ({ options, value, onChange }) => (
    <select className="select-input" value={value} onChange={e => onChange(e.target.value)}>
      <option value="">-- Select Column --</option>
      {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
    </select>
  );

  return (
    <div className="app-container">
      <div className="header">
        <h1>ForecastIQ Pro</h1>
        <p>Advanced Supply Chain Forecaster with Interactive Data Mapping</p>
      </div>

      {step === 1 && (
        <div className="glass-panel main-panel">
          <h2>Step 1: Upload Source Files</h2>
          <div className="upload-grid">
            <FileCard title="Forecast File" type="forecast" icon="📈" />
            <FileCard title="Stock Report" type="stock" icon="📦" />
            <FileCard title="Backlog Report" type="backlog" icon="📋" />
            <FileCard title="PO Tracker" type="po" icon="🚚" />
          </div>
          <div className="action-container">
            <button className="btn-primary" onClick={handleParseFiles} disabled={!allFilesUploaded || loading}>
              {loading ? <span className="loader"></span> : 'Next: Map Columns ➡️'}
            </button>
            {error && <div className="error-message">{error}</div>}
          </div>
        </div>
      )}

      {step === 2 && fileInfo && (
        <div className="glass-panel mapping-panel">
          <div className="flex-between">
            <h2>Step 2: Interactive Data Mapping</h2>
            <button className="btn-secondary" onClick={() => setStep(1)}>⬅️ Back</button>
          </div>
          <p className="subtitle">We've auto-detected the most likely columns. Review and adjust them if needed, or add new columns to your report.</p>

          <div className="mapping-grid">
            {/* Forecast Section */}
            <div className="mapping-card">
              <div className="flex-between">
                <h3>📈 Forecast File</h3>
                <button className="btn-small" onClick={() => setSourcePreview('forecast')}>Preview Data</button>
              </div>
              <div className="field">
                <label>Select Sheet</label>
                <Select options={fileInfo.forecast.sheets} value={config.forecast_sheet} onChange={v => handleSheetChange('forecast', v)} />
              </div>
              <div className="field">
                <label>Part Number Column</label>
                <Select options={fileInfo.forecast.data[config.forecast_sheet]?.columns || []} value={config.forecast_part_col} onChange={v => handleConfigChange('forecast_part_col', v)} />
              </div>
              <div className="field">
                <label>Select Months to Calculate (Total Requirement)</label>
                <MultiSelect options={fileInfo.forecast.data[config.forecast_sheet]?.columns || []} selected={config.forecast_months} onChange={v => handleConfigChange('forecast_months', v)} />
              </div>
            </div>

            {/* Stock Section */}
            <div className="mapping-card">
              <div className="flex-between">
                <h3>📦 Stock Report</h3>
                <button className="btn-small" onClick={() => setSourcePreview('stock')}>Preview Data</button>
              </div>
              <div className="field">
                <label>Select Sheet</label>
                <Select options={fileInfo.stock.sheets} value={config.stock_sheet} onChange={v => handleSheetChange('stock', v)} />
              </div>
              <div className="field">
                <label>Part Number Column</label>
                <Select options={fileInfo.stock.data[config.stock_sheet]?.columns || []} value={config.stock_part_col} onChange={v => handleConfigChange('stock_part_col', v)} />
              </div>
              <div className="field">
                <label>Stock Quantity Columns to Sum</label>
                <MultiSelect options={fileInfo.stock.data[config.stock_sheet]?.columns || []} selected={config.stock_qty_cols} onChange={v => handleConfigChange('stock_qty_cols', v)} />
              </div>
            </div>

            {/* Backlog Section */}
            <div className="mapping-card">
              <div className="flex-between">
                <h3>📋 Backlog Report</h3>
                <button className="btn-small" onClick={() => setSourcePreview('backlog')}>Preview Data</button>
              </div>
              <div className="field">
                <label>Select Sheet</label>
                <Select options={fileInfo.backlog.sheets} value={config.backlog_sheet} onChange={v => handleSheetChange('backlog', v)} />
              </div>
              <div className="field">
                <label>Part Number Column</label>
                <Select options={fileInfo.backlog.data[config.backlog_sheet]?.columns || []} value={config.backlog_part_col} onChange={v => handleConfigChange('backlog_part_col', v)} />
              </div>
              <div className="field">
                <label>Balance Qty Column</label>
                <Select options={fileInfo.backlog.data[config.backlog_sheet]?.columns || []} value={config.backlog_qty_col} onChange={v => handleConfigChange('backlog_qty_col', v)} />
              </div>
              <div className="field-group">
                <div className="field">
                  <label>Customer Filter Column</label>
                  <Select options={fileInfo.backlog.data[config.backlog_sheet]?.columns || []} value={config.backlog_filter_col} onChange={v => handleConfigChange('backlog_filter_col', v)} />
                </div>
                <div className="field">
                  <label>Filter Value</label>
                  <input type="text" className="text-input" value={config.backlog_filter_val} onChange={e => handleConfigChange('backlog_filter_val', e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label>Add Extra Columns to Report</label>
                <MultiSelect options={fileInfo.backlog.data[config.backlog_sheet]?.columns || []} selected={config.backlog_extra_cols} onChange={v => handleConfigChange('backlog_extra_cols', v)} />
              </div>
            </div>

            {/* PO Section */}
            <div className="mapping-card">
              <div className="flex-between">
                <h3>🚚 PO Tracker</h3>
                <button className="btn-small" onClick={() => setSourcePreview('po')}>Preview Data</button>
              </div>
              <div className="field">
                <label>Select Sheet</label>
                <Select options={fileInfo.po.sheets} value={config.po_sheet} onChange={v => handleSheetChange('po', v)} />
              </div>
              <div className="field">
                <label>Part Number Column</label>
                <Select options={fileInfo.po.data[config.po_sheet]?.columns || []} value={config.po_part_col} onChange={v => handleConfigChange('po_part_col', v)} />
              </div>
              <div className="field">
                <label>PO Qty Column</label>
                <Select options={fileInfo.po.data[config.po_sheet]?.columns || []} value={config.po_qty_col} onChange={v => handleConfigChange('po_qty_col', v)} />
              </div>
              <div className="field-group">
                <div className="field">
                  <label>Remark Column (To Filter)</label>
                  <Select options={fileInfo.po.data[config.po_sheet]?.columns || []} value={config.po_remark_col} onChange={v => handleConfigChange('po_remark_col', v)} />
                </div>
                <div className="field">
                  <label>Filter Value (e.g. 'Not Loaded')</label>
                  <input type="text" className="text-input" value={config.po_remark_filter} onChange={e => handleConfigChange('po_remark_filter', e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label>"Sent" Remark Column (For PO In Process)</label>
                <Select options={fileInfo.po.data[config.po_sheet]?.columns || []} value={config.po_status_col} onChange={v => handleConfigChange('po_status_col', v)} />
              </div>
              <div className="field">
                <label>Request Date Column (For Monthly Breakdown)</label>
                <Select options={fileInfo.po.data[config.po_sheet]?.columns || []} value={config.po_date_col} onChange={v => handleConfigChange('po_date_col', v)} />
              </div>
            </div>
          </div>

          <div className="action-container">
            <button className="btn-primary" onClick={handleGeneratePreview} disabled={loading}>
              {loading ? <span className="loader"></span> : 'Generate Report Preview ➡️'}
            </button>
            {error && <div className="error-message">{error}</div>}
          </div>
        </div>
      )}

      {step === 3 && previewData && (
        <div className="glass-panel preview-panel">
          <div className="flex-between" style={{marginBottom: '1rem'}}>
            <h2>Step 3: Verify & Download</h2>
            <div>
              <button className="btn-secondary" style={{marginRight: '1rem'}} onClick={() => setStep(2)}>⬅️ Back to Mapping</button>
              <button className="btn-success" onClick={handleDownload}>⬇️ Download Excel</button>
            </div>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>{previewColumns.map(col => <th key={col}>{col}</th>)}</tr>
              </thead>
              <tbody>
                {previewData.slice(0, 15).map((row, i) => (
                  <tr key={i}>
                    {previewColumns.map(col => (
                      <td key={col}>{row[col] !== null ? String(row[col]) : ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {previewData.length > 15 && <div className="table-footer">Showing top 15 rows of {previewData.length} total rows.</div>}
          </div>
        </div>
      )}

      {/* Source Preview Modal */}
      {sourcePreview && (
        <div className="modal-overlay" onClick={() => setSourcePreview(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex-between" style={{marginBottom: '1rem'}}>
              <h3>Data Preview: {sourcePreview.toUpperCase()}</h3>
              <button className="btn-close" onClick={() => setSourcePreview(null)}>❌</button>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>{fileInfo[sourcePreview].data[config[`${sourcePreview}_sheet`]]?.columns.map(c => <th key={c}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {fileInfo[sourcePreview].data[config[`${sourcePreview}_sheet`]]?.preview.map((row, i) => (
                    <tr key={i}>{fileInfo[sourcePreview].data[config[`${sourcePreview}_sheet`]]?.columns.map(c => <td key={c}>{row[c] !== null ? String(row[c]) : ''}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
