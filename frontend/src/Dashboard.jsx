import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area, ComposedChart } from 'recharts';
import { AlertCircle, TrendingDown, Package, FileWarning, ArrowUpRight, CheckCircle2, Search } from 'lucide-react';

export default function Dashboard({ data, columns, onBack, onDownload }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const lowerSearch = searchTerm.toLowerCase();
    return data.filter(row => 
      String(row['Part Number'] || '').toLowerCase().includes(lowerSearch)
    );
  }, [data, searchTerm]);

  const metrics = useMemo(() => {
    let totalReq = 0;
    let totalStock = 0;
    let partsWithShortage = 0;
    let totalPoNeedToSendQty = 0;
    let totalPoInProcessQty = 0;
    
    // Attempt to identify PO process columns based on names
    const poProcessCols = columns.filter(c => c.includes('In Process'));
    const poPendingCols = columns.filter(c => c.includes('Pending') || c.includes('Need To Send'));

    filteredData.forEach(row => {
      const req = Number(row['Total Requirement']) || 0;
      const stock = Number(row['Total Available Stock']) || 0;
      const shortage = Number(row['Shortage']) || 0;
      
      totalReq += req;
      totalStock += stock;
      if (shortage > 0) partsWithShortage++;
      
      poProcessCols.forEach(col => { totalPoInProcessQty += Number(row[col]) || 0; });
      poPendingCols.forEach(col => { totalPoNeedToSendQty += Number(row[col]) || 0; });
    });

    const fulfillmentRate = totalReq > 0 ? Math.min(100, Math.round((totalStock / totalReq) * 100)) : 100;
    
    const sortedByShortage = [...filteredData].sort((a, b) => (Number(b['Shortage']) || 0) - (Number(a['Shortage']) || 0)).slice(0, 10);
    
    return {
      totalReq,
      totalStock,
      partsWithShortage,
      fulfillmentRate,
      totalPoNeedToSendQty,
      totalPoInProcessQty,
      topShortages: sortedByShortage
    };
  }, [filteredData, columns]);

  return (
    <div className="dashboard-container">
      <div className="flex-between" style={{marginBottom: '1.5rem'}}>
        <h2>Step 3: Managerial Dashboard</h2>
        <div>
          <button className="btn-secondary" style={{marginRight: '1rem'}} onClick={onBack}>⬅️ Back to Mapping</button>
          <button className="btn-success" onClick={onDownload}>⬇️ Download Excel Report</button>
        </div>
      </div>

      <div style={{marginBottom: '1.5rem', position: 'relative'}}>
        <input 
          type="text" 
          className="text-input" 
          placeholder="Search by Part Number..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{width: '100%', paddingLeft: '2.5rem', fontSize: '1.1rem'}}
        />
        <div style={{position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8'}}>
          <Search size={20} />
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon"><TrendingDown size={24} color="#3b82f6" /></div>
          <div>
            <div className="kpi-value">{metrics.fulfillmentRate}%</div>
            <div className="kpi-label">Fulfillment Health</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon"><AlertCircle size={24} color="#ef4444" /></div>
          <div>
            <div className="kpi-value">{metrics.partsWithShortage}</div>
            <div className="kpi-label">Parts w/ Shortage</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon"><FileWarning size={24} color="#f59e0b" /></div>
          <div>
            <div className="kpi-value">{metrics.totalPoNeedToSendQty.toLocaleString()}</div>
            <div className="kpi-label">Pending PO Units</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon"><CheckCircle2 size={24} color="#10b981" /></div>
          <div>
            <div className="kpi-value">{metrics.totalPoInProcessQty.toLocaleString()}</div>
            <div className="kpi-label">Units in Transit (PO)</div>
          </div>
        </div>
      </div>

      <div className="chart-grid">
        <div className="chart-card">
          <h3>Top 10 At-Risk Parts (Highest Shortage)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={metrics.topShortages} margin={{top: 20, right: 30, left: 20, bottom: 5}}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="Part Number" tick={{fontSize: 12}} />
              <YAxis />
              <RechartsTooltip />
              <Legend />
              <Bar dataKey="Shortage" fill="#ef4444" name="Shortage Qty" />
              <Bar dataKey="Total Available Stock" fill="#10b981" name="Available Stock" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card action-center">
          <h3>🚨 Action Center</h3>
          <div className="alert-list">
            {metrics.topShortages.slice(0, 5).map((part, idx) => (
              <div key={idx} className={`alert-item ${part['Need PO'] === 'Yes' ? 'critical' : 'warning'}`}>
                {part['Need PO'] === 'Yes' && <AlertCircle size={18} />}
                {part['Pull in parts'] === 'Yes' && part['Need PO'] === 'No' && <ArrowUpRight size={18} />}
                <div>
                  <strong>{part['Part Number']}</strong>
                  <div>
                    {part['Need PO'] === 'Yes' ? `Urgent: Shortage of ${part['Shortage']}. Create PO immediately.` : 
                     part['Pull in parts'] === 'Yes' ? `Action: Pull-in needed. PO exists but shortage imminent.` :
                     `Upload PO missing in system.`}
                  </div>
                </div>
              </div>
            ))}
            {metrics.partsWithShortage === 0 && (
              <div className="alert-item success">
                <CheckCircle2 size={18} />
                <div><strong>All Good!</strong> No immediate shortages detected.</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{marginTop: '2rem'}}>
        <h3 style={{marginBottom: '1rem'}}>Detailed Data Table</h3>
        <div className="table-container" style={{maxHeight: '400px', overflowY: 'auto'}}>
          <table>
            <thead>
              <tr>{columns.map(col => <th key={col}>{col}</th>)}</tr>
            </thead>
            <tbody>
              {filteredData.slice(0, 50).map((row, i) => (
                <tr key={i}>
                  {columns.map(col => (
                    <td key={col}>{row[col] !== null ? String(row[col]) : ''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
