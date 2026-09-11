import React, { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { useAuth } from '../context/AuthContext';
import ChartSection from './ChartSection';
import InsightsCard from './InsightsCard';
import DataIngestionModal from './DataIngestionModal';
import { UploadCloud } from 'lucide-react';
import { RefreshCw, Filter } from 'lucide-react';

// Debounce hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const SERIES_OPTIONS = [
  "All", "1608 series", "67-11 and 67-21 series", "67-41 series", 
  "65-11 and 65-21 series", "2820", "XI3030", "ALFS", "Other"
];

const GRANULARITIES = [
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'half_yearly', label: 'Half-Yearly' },
  { id: 'annual', label: 'Annual' }
];

export default function EVLAnalyticsView() {
  const { fetchWithAuth } = useAuth();
  
  const [series, setSeries] = useState("All");
  const [partNumber, setPartNumber] = useState("");
  const debouncedPartNumber = useDebounce(partNumber, 500);
  const [granularity, setGranularity] = useState("monthly");
  
  const [data, setData] = useState([]);
  const [insights, setInsights] = useState([]);
  
  // Groq Chat State
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const handleAskQuestion = async (e) => {
    if (e) e.preventDefault();
    if (!chatQuestion.trim() || !debouncedPartNumber) return;

    const userMsg = chatQuestion;
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatQuestion("");
    setIsChatLoading(true);

    try {
      const response = await fetchWithAuth(`/api/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          part_number: debouncedPartNumber,
          question: userMsg
        })
      });
      
      const data = await response.json();
      if (response.ok) {
        setChatHistory(prev => [...prev, { role: 'ai', text: data.answer }]);
      } else {
        setChatHistory(prev => [...prev, { role: 'ai', text: 'Error: ' + data.detail }]);
      }
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'ai', text: 'Network error. Please try again.' }]);
    }
    setIsChatLoading(false);
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [leadTimeWeeks, setLeadTimeWeeks] = useState(8);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({ granularity });
      if (series !== "All") queryParams.append("series", series);
      if (debouncedPartNumber) queryParams.append("part_number", debouncedPartNumber);
      queryParams.append("lead_time_weeks", leadTimeWeeks);
      
      const res = await fetchWithAuth(`/api/v1/analytics/view?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch analytics data");
      const json = await res.json();
      setData(json.chart_data || []);
      setInsights(["Loading AI insights..."]);

      // Fetch Groq Insights asynchronously without blocking chart render
      fetchWithAuth(`/api/v1/analytics/insights?${queryParams.toString()}`)
        .then(r => r.json())
        .then(resJson => {
          if (resJson.insight) {
            setInsights([resJson.insight]);
          } else {
             setInsights([]);
          }
        })
        .catch(e => {
          console.error("Groq insight error", e);
          setInsights(["Failed to generate insights."]);
        });

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [series, debouncedPartNumber, granularity, leadTimeWeeks, fetchWithAuth]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Header & Controls */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            
<div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="bg-indigo-600 p-2 rounded-lg">
                  <Filter className="text-white" size={24} />
                </div>
                <h1 className="text-xl font-bold text-gray-900">EVL Supply Chain Analytics</h1>
              </div>
              <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200 ml-4">
                <span className="text-sm font-medium text-indigo-700">Lead Time: {leadTimeWeeks}w</span>
                <input 
                  type="range" 
                  min="2" max="16" step="1"
                  value={leadTimeWeeks} 
                  onChange={(e) => setLeadTimeWeeks(Number(e.target.value))}
                  className="w-24 accent-indigo-600"
                />
              </div>
              <button 
                onClick={() => setIsUploadModalOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 font-medium transition-colors border border-indigo-200 ml-4"
              >
                <UploadCloud size={16} />
                Upload Data
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              {/* Granularity Switcher */}
              <div className="flex bg-gray-100 p-1 rounded-lg">
                {GRANULARITIES.map(g => (
                  <button
                    key={g.id}
                    onClick={() => setGranularity(g.id)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      granularity === g.id ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>

              {/* Series Dropdown */}
              <select
                value={series}
                onChange={(e) => setSeries(e.target.value)}
                className="form-select block w-48 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                {SERIES_OPTIONS.map(opt => <option key={opt} value={opt}>{opt === "All" ? "All Series" : opt}</option>)}
              </select>

              {/* Part Number Search */}
              <input
                type="text"
                placeholder="Search Part #..."
                value={partNumber}
                onChange={(e) => setPartNumber(e.target.value)}
                className="form-input block w-48 pl-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
              
              <button 
                onClick={fetchAnalytics}
                className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                title="Refresh Data"
              >
                <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
            <p className="text-red-700 font-medium">Error loading data: {error}</p>
          </div>
        )}

        {loading && data.length === 0 ? (
          /* Loading Skeletons */
          <div className="animate-pulse space-y-6">
            <div className="h-96 bg-gray-200 rounded-xl"></div>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-2 h-80 bg-gray-200 rounded-xl"></div>
              <div className="h-80 bg-gray-200 rounded-xl"></div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <ChartSection data={data} />
            

            <div className="grid md:grid-cols-1 gap-6">
              <InsightsCard data={data} insights={insights} />
            </div>

            {/* Groq AI Chatbox for Kundali History */}
            {debouncedPartNumber && (
              <div className="bg-white p-6 border border-gray-200 rounded-xl shadow-sm mt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                  Ask Groq AI about Part History (Kundali)
                </h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 h-64 overflow-y-auto mb-4 flex flex-col gap-3">
                  {chatHistory.length === 0 ? (
                    <p className="text-gray-400 text-center mt-20">Ask me what the historical demand or backlog was for this part in any month!</p>
                  ) : (
                    chatHistory.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-3 rounded-lg text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'}`}>
                          
                          {msg.role === 'user' ? (
                            msg.text
                          ) : (
                            <div className="markdown-chat">
                              <ReactMarkdown 
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  table: ({node, ...props}) => <table className="w-full text-left border-collapse my-2" {...props} />,
                                  th: ({node, ...props}) => <th className="border-b-2 border-gray-300 p-2 font-bold" {...props} />,
                                  td: ({node, ...props}) => <td className="border-b border-gray-200 p-2" {...props} />,
                                  p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                                  strong: ({node, ...props}) => <strong className="font-bold text-gray-900" {...props} />
                                }}
                              >
                                {msg.text}
                              </ReactMarkdown>
                            </div>
                          )}

                        </div>
                      </div>
                    ))
                  )}
                  {isChatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-gray-200 p-3 rounded-lg text-sm text-gray-500 rounded-bl-none shadow-sm flex items-center gap-2">
                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-75"></div>
                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-150"></div>
                      </div>
                    </div>
                  )}
                </div>
                <form onSubmit={handleAskQuestion} className="flex gap-2">
                  <input 
                    type="text" 
                    value={chatQuestion}
                    onChange={(e) => setChatQuestion(e.target.value)}
                    placeholder={`Ask about ${debouncedPartNumber}'s history...`}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button 
                    type="submit" 
                    disabled={isChatLoading || !chatQuestion.trim()}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg disabled:opacity-50 transition-colors"
                  >
                    Ask
                  </button>
                </form>
              </div>
            )}

          </div>
        )}
      </main>
      <DataIngestionModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)} 
        onUploadSuccess={() => { setIsUploadModalOpen(false); fetchAnalytics(); }} 
      />
    </div>
  );
}
