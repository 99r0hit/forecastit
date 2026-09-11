import React from 'react';
import { Lightbulb, TrendingUp, Package, Activity } from 'lucide-react';

export default function InsightsCard({ data, insights }) {
  // Compute some quick KPIs from data if available
  let totalShipment = 0;
  let totalDemand = 0;
  let avgInv = 0;
  
  if (data && data.length > 0) {
    totalShipment = data.reduce((sum, row) => sum + (Number(row.evl_shipment) || 0), 0);
    totalDemand = data.reduce((sum, row) => sum + (Number(row.customer_demand) || 0), 0);
    const invSum = data.reduce((sum, row) => sum + (Number(row.inventory) || 0), 0);
    avgInv = invSum / data.length;
  }
  
  const fulfillmentPct = totalDemand > 0 ? ((totalShipment / totalDemand) * 100).toFixed(1) : 100;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="bg-indigo-50 border-b border-indigo-100 p-4 flex items-center gap-2">
        <Lightbulb className="text-indigo-600" size={20} />
        <h3 className="text-lg font-semibold text-indigo-900">Automated Business Insights</h3>
      </div>
      
      <div className="p-6">
        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <Package size={16} />
              <span className="text-sm font-medium">Total Shipment</span>
            </div>
            <div className="text-2xl font-bold text-gray-800">
              {totalShipment.toLocaleString()}
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <TrendingUp size={16} />
              <span className="text-sm font-medium">Fulfillment %</span>
            </div>
            <div className="text-2xl font-bold text-gray-800">
              {fulfillmentPct}%
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <Activity size={16} />
              <span className="text-sm font-medium">Avg Inventory</span>
            </div>
            <div className="text-2xl font-bold text-gray-800">
              {Math.round(avgInv).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Insights List */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Key Observations</h4>
          {insights && insights.length > 0 ? (
            <ul className="space-y-3">
              {insights.map((insight, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="text-gray-700 leading-relaxed">{insight}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 italic">No automated insights available for this selection.</p>
          )}
        </div>
      </div>
    </div>
  );
}
