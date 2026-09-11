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
    <div className={`relative block w-full border-2 border-dashed rounded-lg p-6 text-center hover:border-indigo-500 transition-colors cursor-pointer ${files[type] ? "border-green-500 bg-green-50" : "border-gray-300 bg-white"}`}>
      <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept=".xlsx,.xls" onChange={(e) => handleFileChange(e, type)} />
      <div className="mx-auto text-4xl mb-3">{files[type] ? '✅' : icon}</div>
      <div className="mt-2 block text-sm font-medium text-gray-900">{title}</div>
      {files[type] && <div className="mt-2 block text-xs text-gray-500 truncate">{files[type].name}</div>}
    </div>
  );

  const MultiSelect = ({ options, selected, onChange }) => {
    const toggle = (opt) => {
      if (selected.includes(opt)) onChange(selected.filter(x => x !== opt));
      else onChange([...selected, opt]);
    };
    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {options.map(opt => (
          <label key={opt} className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border cursor-pointer transition-colors ${selected.includes(opt) ? "bg-indigo-100 text-indigo-800 border-indigo-500" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}>
            <input type="checkbox" className="sr-only" checked={selected.includes(opt)} onChange={() => toggle(opt)} />
            {opt}
          </label>
        ))}
      </div>
    );
  };

  const Select = ({ options, value, onChange }) => (
    <select className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm border bg-white" value={value} onChange={e => onChange(e.target.value)}>
      <option value="">-- Select Column --</option>
      {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
    </select>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">ForecastIQ Pro</h1>
        <p className="mt-4 text-lg text-gray-500">Advanced Supply Chain Forecaster with Interactive Data Mapping</p>
      </div>

      {step === 1 && (
        <div className="bg-white shadow-xl sm:rounded-lg border border-gray-200 p-8 max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-4 border-gray-200">Step 1: Upload Source Files</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <FileCard title="Forecast File" type="forecast" icon="📈" />
            <FileCard title="Stock Report" type="stock" icon="📦" />
            <FileCard title="Backlog Report" type="backlog" icon="📋" />
            <FileCard title="PO Tracker" type="po" icon="🚚" />
          </div>
          <div className="mt-8 flex justify-end gap-4">
            <button className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors" onClick={handleParseFiles} disabled={!allFilesUploaded || loading}>
              {loading ? <span className="animate-spin inline-block w-5 h-5 border-[3px] border-current border-t-transparent text-white rounded-full"></span> : 'Next: Map Columns ➡️'}
            </button>
            {error && <div className="mt-4 p-4 bg-red-50 text-sm text-red-700 rounded-md border border-red-200">{error}</div>}
          </div>
        </div>
      )}

      {step === 2 && fileInfo && (
        <div className="glass-panel mapping-panel">
          <div className="flex-between">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-4 border-gray-200">Step 2: Interactive Data Mapping</h2>
            <button className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors" onClick={() => setStep(1)}>⬅️ Back</button>
          </div>
          <p className="subtitle">We've auto-detected the most likely columns. Review and adjust them if needed, or add new columns to your report.</p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Forecast Section */}
            <div className="bg-gray-50 shadow-sm rounded-xl border border-gray-200 p-6">
              <div className="flex-between">
                <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">📈 Forecast File</h3>
                <button className="btn-small" onClick={() => setSourcePreview('forecast')}>Preview Data</button>
              </div>
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Sheet</label>
                <Select options={fileInfo.forecast.sheets} value={config.forecast_sheet} onChange={v => handleSheetChange('forecast', v)} />
              </div>
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-1">Part Number Column</label>
                <Select options={fileInfo.forecast.data[config.forecast_sheet]?.columns || []} value={config.forecast_part_col} onChange={v => handleConfigChange('forecast_part_col', v)} />
              </div>
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Months to Calculate (Total Requirement)</label>
                <MultiSelect options={fileInfo.forecast.data[config.forecast_sheet]?.columns || []} selected={config.forecast_months} onChange={v => handleConfigChange('forecast_months', v)} />
              </div>
            </div>

            {/* Stock Section */}
            <div className="bg-gray-50 shadow-sm rounded-xl border border-gray-200 p-6">
              <div className="flex-between">
                <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">📦 Stock Report</h3>
                <button className="btn-small" onClick={() => setSourcePreview('stock')}>Preview Data</button>
              </div>
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Sheet</label>
                <Select options={fileInfo.stock.sheets} value={config.stock_sheet} onChange={v => handleSheetChange('stock', v)} />
              </div>
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-1">Part Number Column</label>
                <Select options={fileInfo.stock.data[config.stock_sheet]?.columns || []} value={config.stock_part_col} onChange={v => handleConfigChange('stock_part_col', v)} />
              </div>
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock Quantity Columns to Sum</label>
                <MultiSelect options={fileInfo.stock.data[config.stock_sheet]?.columns || []} selected={config.stock_qty_cols} onChange={v => handleConfigChange('stock_qty_cols', v)} />
              </div>
            </div>

            {/* Backlog Section */}
            <div className="bg-gray-50 shadow-sm rounded-xl border border-gray-200 p-6">
              <div className="flex-between">
                <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">📋 Backlog Report</h3>
                <button className="btn-small" onClick={() => setSourcePreview('backlog')}>Preview Data</button>
              </div>
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Sheet</label>
                <Select options={fileInfo.backlog.sheets} value={config.backlog_sheet} onChange={v => handleSheetChange('backlog', v)} />
              </div>
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-1">Part Number Column</label>
                <Select options={fileInfo.backlog.data[config.backlog_sheet]?.columns || []} value={config.backlog_part_col} onChange={v => handleConfigChange('backlog_part_col', v)} />
              </div>
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-1">Balance Qty Column</label>
                <Select options={fileInfo.backlog.data[config.backlog_sheet]?.columns || []} value={config.backlog_qty_col} onChange={v => handleConfigChange('backlog_qty_col', v)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="mb-5">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Filter Column</label>
                  <Select options={fileInfo.backlog.data[config.backlog_sheet]?.columns || []} value={config.backlog_filter_col} onChange={v => handleConfigChange('backlog_filter_col', v)} />
                </div>
                <div className="mb-5">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filter Value</label>
                  <input type="text" className="mt-1 block w-full px-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm border bg-white" value={config.backlog_filter_val} onChange={e => handleConfigChange('backlog_filter_val', e.target.value)} />
                </div>
              </div>
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-1">Add Extra Columns to Report</label>
                <MultiSelect options={fileInfo.backlog.data[config.backlog_sheet]?.columns || []} selected={config.backlog_extra_cols} onChange={v => handleConfigChange('backlog_extra_cols', v)} />
              </div>
            </div>

            {/* PO Section */}
            <div className="bg-gray-50 shadow-sm rounded-xl border border-gray-200 p-6">
              <div className="flex-between">
                <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">🚚 PO Tracker</h3>
                <button className="btn-small" onClick={() => setSourcePreview('po')}>Preview Data</button>
              </div>
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Sheet</label>
                <Select options={fileInfo.po.sheets} value={config.po_sheet} onChange={v => handleSheetChange('po', v)} />
              </div>
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-1">Part Number Column</label>
                <Select options={fileInfo.po.data[config.po_sheet]?.columns || []} value={config.po_part_col} onChange={v => handleConfigChange('po_part_col', v)} />
              </div>
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-1">PO Qty Column</label>
                <Select options={fileInfo.po.data[config.po_sheet]?.columns || []} value={config.po_qty_col} onChange={v => handleConfigChange('po_qty_col', v)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="mb-5">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Remark Column (To Filter)</label>
                  <Select options={fileInfo.po.data[config.po_sheet]?.columns || []} value={config.po_remark_col} onChange={v => handleConfigChange('po_remark_col', v)} />
                </div>
                <div className="mb-5">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filter Value (e.g. 'Not Loaded')</label>
                  <input type="text" className="mt-1 block w-full px-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm border bg-white" value={config.po_remark_filter} onChange={e => handleConfigChange('po_remark_filter', e.target.value)} />
                </div>
              </div>
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-1">"Sent" Remark Column (For PO In Process)</label>
                <Select options={fileInfo.po.data[config.po_sheet]?.columns || []} value={config.po_status_col} onChange={v => handleConfigChange('po_status_col', v)} />
              </div>
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-1">Request Date Column (For Monthly Breakdown)</label>
                <Select options={fileInfo.po.data[config.po_sheet]?.columns || []} value={config.po_date_col} onChange={v => handleConfigChange('po_date_col', v)} />
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-4">
            <button className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors" onClick={handleGeneratePreview} disabled={loading}>
              {loading ? <span className="animate-spin inline-block w-5 h-5 border-[3px] border-current border-t-transparent text-white rounded-full"></span> : 'Generate Report Preview ➡️'}
            </button>
            {error && <div className="mt-4 p-4 bg-red-50 text-sm text-red-700 rounded-md border border-red-200">{error}</div>}
          </div>
        </div>
      )}

      {step === 3 && previewData && (
        <div className="glass-panel preview-panel">
          <div className="flex-between" className="mb-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-4 border-gray-200">Step 3: Verify & Download</h2>
            <div>
              <button className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors" className="mr-4" onClick={() => setStep(2)}>⬅️ Back to Mapping</button>
              <button className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 transition-colors" onClick={handleDownload}>⬇️ Download Excel</button>
            </div>
          </div>
          <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 rounded-lg mt-6 max-h-[500px]">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr className="hover:bg-gray-50 transition-colors">{previewColumns.map(col => <th key={col}>{col}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {previewData.slice(0, 15).map((row, i) => (
                  <tr key={i}>
                    {previewColumns.map(col => (
                      <td key={col}>{row[col] !== null ? String(row[col]) : ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {previewData.length > 15 && <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-500 text-center">Showing top 15 rows of {previewData.length} total rows.</div>}
          </div>
        </div>
      )}

      {/* Source Preview Modal */}
      {sourcePreview && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity" onClick={() => setSourcePreview(null)}>
          <div className="bg-white rounded-xl shadow-xl overflow-hidden max-w-5xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex-between" className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">Data Preview: {sourcePreview.toUpperCase()}</h3>
              <button className="btn-close" onClick={() => setSourcePreview(null)}>❌</button>
            </div>
            <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 rounded-lg mt-6 max-h-[500px]">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr className="hover:bg-gray-50 transition-colors">{fileInfo[sourcePreview].data[config[`${sourcePreview}_sheet`]]?.columns.map(c => <th key={c}>{c}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
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
