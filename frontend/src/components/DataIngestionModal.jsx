import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UploadCloud, X, Loader2, FileSpreadsheet, CheckCircle, Database } from 'lucide-react';

export default function DataIngestionModal({ isOpen, onClose, onUploadSuccess }) {
  const { fetchWithAuth } = useAuth();
  
  const [files, setFiles] = useState({
    demand_file: null,
    stock_file: null,
    booking_file: null,
    pos_file: null,
    shipment_file: null
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  if (!isOpen) return null;

  const handleFileChange = (e, key) => {
    setFiles({ ...files, [key]: e.target.files[0] });
  };

  const handleUpload = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    let hasFiles = false;
    Object.keys(files).forEach(key => {
      if (files[key]) {
        formData.append(key, files[key]);
        hasFiles = true;
      }
    });

    if (!hasFiles) {
      setError("Please select at least one file to upload.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetchWithAuth('/api/v1/ingest', {
        method: 'POST',
        body: formData
      }, true); 

      if (!response.ok) {
        throw new Error("Failed to upload data");
      }

      const resJson = await response.json();
      setSuccess(`Successfully ingested ${resJson.records_imported.toLocaleString()} rows into the cloud database in ${resJson.execution_time_ms}ms.`);
      setTimeout(() => {
        if (onUploadSuccess) onUploadSuccess();
      }, 2000);
    } catch (err) {
      setError(err.message || "An error occurred during upload.");
    } finally {
      setLoading(false);
    }
  };

  const fileInputs = [
    { key: 'demand_file', label: 'Forecast (Demand)', desc: 'Customer forecast requirements' },
    { key: 'stock_file', label: 'Inventory (Stock)', desc: 'Swingtel stock snapshot' },
    { key: 'booking_file', label: 'EVL Backlog', desc: 'Everlight balance to ship' },
    { key: 'pos_file', label: 'POS & POP', desc: 'Point of sale / billing data' },
    { key: 'shipment_file', label: 'PO Tracker', desc: 'Active Purchase Orders' },
  ];

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 p-2.5 rounded-xl">
              <Database className="text-indigo-600" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Data Synchronization</h2>
              <p className="text-sm text-gray-500 font-medium mt-0.5">Push new Excel reports to Supabase</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-all">
            <X size={24} />
          </button>
        </div>
        
        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fileInputs.map(({ key, label, desc }) => (
              <div 
                key={key} 
                className={`relative flex items-center p-4 border-2 rounded-xl transition-all ${
                  files[key] 
                    ? 'border-indigo-500 bg-indigo-50/30' 
                    : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm'
                }`}
              >
                <div className="flex-shrink-0 mr-4">
                  {files[key] ? (
                    <CheckCircle className="text-indigo-600" size={28} />
                  ) : (
                    <div className="p-2 bg-gray-50 rounded-lg text-gray-400">
                      <FileSpreadsheet size={24} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">{label}</p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {files[key] ? files[key].name : desc}
                  </p>
                </div>
                
                {/* Hidden File Input covering the entire card */}
                <input 
                  type="file" 
                  accept=".xlsx,.xls" 
                  onChange={(e) => handleFileChange(e, key)} 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  title={`Upload ${label}`}
                />
              </div>
            ))}
          </div>

          {/* Alerts */}
          <div className="mt-6">
            {error && (
              <div className="p-4 bg-red-50 text-red-700 text-sm font-medium rounded-xl border border-red-100 flex items-center gap-2">
                <X size={16} /> {error}
              </div>
            )}
            {success && (
              <div className="p-4 bg-green-50 text-green-700 text-sm font-medium rounded-xl border border-green-100 flex items-center gap-2">
                <CheckCircle size={16} /> {success}
              </div>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-white flex justify-end gap-3">
          <button 
            onClick={onClose} 
            disabled={loading} 
            className="px-6 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-all focus:ring-2 focus:ring-gray-200"
          >
            Cancel
          </button>
          <button 
            onClick={handleUpload} 
            disabled={loading} 
            className="px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 border border-transparent rounded-xl hover:bg-indigo-700 transition-all shadow-sm focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 flex items-center gap-2 disabled:opacity-70"
          >
            {loading ? (
              <><Loader2 className="animate-spin" size={18} /> Syncing to Cloud...</>
            ) : (
              <><UploadCloud size={18} /> Upload & Sync Data</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
