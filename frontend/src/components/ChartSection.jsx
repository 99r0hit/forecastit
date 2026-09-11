import React from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

export default function ChartSection({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-gray-500">No data available for the selected filters.</p>
      </div>
    );
  }


  const formatNumber = (num) => {
    if (num === 0) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'kk';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return num.toString();
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-200 rounded shadow-lg text-sm">
          <p className="font-bold mb-2">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex justify-between gap-4 mb-1" style={{ color: entry.color }}>
              <span>{entry.name}:</span>
              <span className="font-semibold">{formatNumber(entry.value)} units</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Row 1: Line Chart (Trend) */}
      <div className="bg-white p-6 border border-gray-200 rounded-xl shadow-sm">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Demand & Fulfillment Trend</h3>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="period" stroke="#6b7280" tick={{fontSize: 12}} />
              <YAxis stroke="#6b7280" tick={{fontSize: 12}} tickFormatter={formatNumber} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Bar dataKey="customer_demand" name="Customer Demand" fill="#3b82f6" />
              <Bar dataKey="evl_shipment" name="Loaded PO" stackId="po" fill="#8b5cf6" />
              <Bar dataKey="pending_po" name="Pending PO" stackId="po" fill="#c4b5fd" />
              <Bar dataKey="evl_booking" name="Healthy Backlog" stackId="backlog" fill="#f59e0b" />
              <Bar dataKey="at_risk_backlog" name="At-Risk Backlog" stackId="backlog" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Bar Chart (POS vs Inventory) */}
      <div className="bg-white p-6 border border-gray-200 rounded-xl shadow-sm">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">POS vs Ending Inventory</h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="period" stroke="#6b7280" tick={{fontSize: 12}} />
              <YAxis stroke="#6b7280" tick={{fontSize: 12}} tickFormatter={formatNumber} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ paddingTop: '10px' }} />
              <Bar dataKey="pos" name="POS (Sales)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="inventory" name="Ending Inventory" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
