/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Activity, 
  Clock, 
  Users, 
  ShieldAlert, 
  ChevronRight, 
  MessageSquare, 
  PhoneCall, 
  CheckCircle2,
  Bell,
  Terminal,
  BarChart3,
  Layers,
  History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { Incident, Priority, IncidentStatus, TeamMember } from './types';

const MOCK_INCIDENTS: Incident[] = [
  {
    id: 'OMG/2345',
    title: 'Latency Spike in Checkout Flow',
    priority: 'Huge',
    status: 'Monitoring',
    startTime: new Date(Date.now() - 120 * 60000).toISOString(),
    description: 'Checkout page load times increased from 800ms to 4.5s.',
    commander: 'VPC',
    affectedServices: ['VPC'],
    impactedCustomers: ['FoodDash', 'QuickShop'],
    requestingPOC: 'Bhushan K',
    escalations: [
      { level: 1, role: 'Backend Dev', name: 'Li Wei', status: 'Informed', time: '12:45' }
    ]
  }
];

const MOCK_STATS = [
  { time: '08:00', incidents: 1, latency: 45 },
  { time: '10:00', incidents: 2, latency: 52 },
  { time: '12:00', incidents: 4, latency: 120 },
  { time: '14:00', incidents: 8, latency: 340 },
  { time: '16:00', incidents: 5, latency: 180 },
  { time: '18:00', incidents: 3, latency: 90 },
];

const ON_CALL_TEAM: TeamMember[] = [
  { id: '1', name: 'Bhushan', role: 'CMIC', status: 'Available', contact: '--' },
  { id: '2', name: 'Saurabh', role: 'ICL', status: 'Available', contact: '--' },
  { id: '3', name: 'Likitha', role: 'ECL', status: 'Available', contact: '--' },
  { id: '4', name: 'Benson', role: 'Cloud-IRT', status: 'Available', contact: '--' },
  { id: '5', name: 'Aminisha', role: 'Comms Manager', status: 'Available', contact: '--' },
];

interface DashboardGridProps {
  incidents: Incident[];
  selectedIncident: Incident | null;
  setSelectedIncident: (incident: Incident | null) => void;
  getPriorityColor: (p: Priority) => string;
  getStatusIcon: (s: IncidentStatus) => React.ReactNode;
  bannerTitle?: string;
  showDuration?: boolean;
  showBanner?: boolean;
  sectionTitle?: string;
  showCriticalBadge?: boolean;
  showTeam?: boolean;
  showImpactedCustomers?: boolean;
  showCommsBlast?: boolean;
  bridgeTitle?: string;
  caseTitle?: string;
  caseContent?: React.ReactNode;
  caseTitle2?: string;
  caseContent2?: React.ReactNode;
  columnHeaders?: {
    poc?: string;
    id: string;
    severity: string;
    status: string;
    service: string;
    location: string;
    updates: string;
  };
}

const DashboardGrid = ({ 
  incidents, 
  selectedIncident, 
  setSelectedIncident, 
  getPriorityColor, 
  getStatusIcon,
  bannerTitle = "Critical Active",
  showDuration = true,
  showBanner = true,
  sectionTitle = "Cloud Major Incident",
  showCriticalBadge = true,
  showTeam = true,
  showImpactedCustomers = true,
  showCommsBlast = true,
  bridgeTitle = "Open MIM Bridge",
  caseTitle,
  caseContent,
  caseTitle2,
  caseContent2,
  columnHeaders = {
    poc: "Requesting POC",
    id: "OMG ID",
    severity: "Severity",
    status: "Status",
    service: "service name",
    location: "regions/Zone affected",
    updates: "CMI updates"
  }
}: DashboardGridProps) => (
  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
    {/* Left Column - Incident Feed */}
    <div className="md:col-span-8 flex flex-col gap-4">
      
      {/* Active Banner */}
      {showBanner && (
        <section className="bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg overflow-hidden shadow-2xl relative">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <ShieldAlert size={140} />
          </div>
          <div className="p-6 relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <span className="px-2 py-0.5 bg-red-500 text-white text-[9px] font-bold uppercase tracking-wider rounded">{bannerTitle}</span>
              {showDuration && <span className="font-mono text-xs text-zinc-500">Duration: 0h 45m</span>}
            </div>
            <h2 className="text-2xl font-bold mb-4 leading-tight max-w-2xl">
              {incidents[0].title}
            </h2>
            <div className="flex flex-wrap gap-3 mt-6">
              <a 
                href="http://go/ocm-panic"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-zinc-100 text-zinc-950 font-bold uppercase text-[10px] tracking-widest hover:bg-white transition-all rounded"
              >
                Join War Room
              </a>
              <a 
                href="https://pantheon.corp.google.com/servicehealth/incidents?e=13802955&mods=perf_metrics&project=cloud-service-health&pli=1"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-transparent border border-zinc-700 text-zinc-300 font-bold uppercase text-[10px] tracking-widest hover:bg-zinc-800 transition-all rounded inline-block"
              >
                Personalized Service Health (PSH)
              </a>
            </div>
          </div>
        </section>
      )}

      {/* Detailed View / Table */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden flex flex-col min-h-0">
        <div className="border-b border-zinc-800 p-3 flex items-center justify-between bg-zinc-950/50">
          <h2 className="font-bold uppercase text-[10px] tracking-widest text-zinc-500 text-xs">{sectionTitle}</h2>
          <div className="flex gap-2 text-[10px]">
            <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">ALL</span>
            {showCriticalBadge && <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-500">CRITICAL</span>}
          </div>
        </div>
        
        <div className="overflow-x-auto overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-950 text-[9px] font-bold uppercase tracking-widest border-b border-zinc-800 text-zinc-500">
                {columnHeaders.poc && <th className="px-4 py-3 font-semibold">{columnHeaders.poc}</th>}
                <th className="px-4 py-3 font-semibold">{columnHeaders.id}</th>
                <th className="px-4 py-3 font-semibold">{columnHeaders.severity}</th>
                <th className="px-4 py-3 font-semibold">{columnHeaders.status}</th>
                <th className="px-4 py-3 font-semibold">{columnHeaders.service}</th>
                <th className="px-4 py-3 font-semibold">{columnHeaders.location}</th>
                <th className="px-4 py-3 text-right">{columnHeaders.updates}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {incidents.map((incident) => (
                <motion.tr 
                  key={incident.id}
                  onClick={() => setSelectedIncident(incident)}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`group hover:bg-zinc-800/50 cursor-pointer transition-colors ${selectedIncident?.id === incident.id ? 'bg-zinc-800/80' : ''}`}
                >
                  {columnHeaders.poc && <td className="px-4 py-3 font-medium text-zinc-300">{incident.requestingPOC || '--'}</td>}
                  <td className="px-4 py-3 font-mono text-zinc-400">{incident.id}</td>
                  <td className="px-4 py-3">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${getPriorityColor(incident.priority)}`}>
                      {incident.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-medium">
                      {getStatusIcon(incident.status)}
                      {incident.status}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{incident.affectedServices[0]}</td>
                  <td className="px-4 py-3 font-mono text-zinc-500 uppercase tracking-tighter font-bold">Global</td>
                  <td className="px-4 py-3 text-right">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedIncident(incident);
                        setTimeout(() => {
                          document.getElementById('latest-comms-blast')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 100);
                      }}
                      className="text-[10px] border border-zinc-700 px-2 py-1 rounded hover:bg-zinc-700 transition-colors uppercase font-bold tracking-tighter"
                    >
                      Open LOG
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Latest Comms Blast Section */}
      <AnimatePresence mode="wait">
        {showCommsBlast && selectedIncident && (
          <motion.section
            key={selectedIncident.id}
            id="latest-comms-blast"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 shadow-sm"
          >
            <div className="bg-zinc-950 p-4 rounded border border-zinc-800 font-mono text-[11px]">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <p className="text-zinc-500 uppercase text-[10px] font-bold tracking-widest">Latest Comms Blast - {selectedIncident.id}</p>
              </div>
              <div className="bg-zinc-900/50 p-8 border border-zinc-800/50 rounded-sm mb-4 min-h-[360px] flex flex-col justify-center">
                <p className="text-zinc-200 leading-relaxed text-base">
                  {selectedIncident.description}
                </p>
              </div>
              <div className="flex justify-between items-center text-[10px] mb-6">
                <div className="flex gap-4">
                  <span className="text-zinc-600 uppercase font-bold">Sent 4m ago</span>
                  <span className="text-zinc-600 uppercase font-bold">BY: MIM-ADMIN-01</span>
                </div>
                <div className="flex gap-2">
                  <button className="text-zinc-400 border border-zinc-700 px-3 py-1 rounded hover:bg-zinc-800 transition-colors uppercase font-bold tracking-tighter">Copy Text</button>
                </div>
              </div>

              {/* Comms History Table */}
              <div className="mt-8 pt-6 border-t border-zinc-800">
                <h4 className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-3 flex items-center gap-2">
                  <History size={10} /> History of Comms
                </h4>
                <div className="overflow-hidden rounded border border-zinc-800/50">
                  <table className="w-full text-[9px] text-left">
                    <thead className="bg-zinc-900 text-zinc-500 uppercase tracking-widest font-bold">
                      <tr>
                        <th className="px-3 py-2">Timestamp</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">IEM POC</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50 text-zinc-400">
                      <tr>
                        <td className="px-3 py-2 italic">2026-04-24 03:25</td>
                        <td className="px-3 py-2 uppercase">Update #2</td>
                        <td className="px-3 py-2">mim-admin-01</td>
                      </tr>
                      <tr className="bg-zinc-900/30">
                        <td className="px-3 py-2 italic">2026-04-24 03:20</td>
                        <td className="px-3 py-2 uppercase">Update #1</td>
                        <td className="px-3 py-2">mim-admin-01</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 italic">2026-04-24 03:10</td>
                        <td className="px-3 py-2 uppercase">Initial update</td>
                        <td className="px-3 py-2">system-bot</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>

    {/* Right Column - Secondary Data */}
    <aside className="md:col-span-4 flex flex-col gap-4">
      
      {/* On-Call Directory */}
      {showTeam && (
        <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 shadow-sm overflow-hidden">
          <h3 className="font-bold uppercase text-[10px] tracking-widest text-zinc-500 mb-4 flex items-center justify-between">
            Primary Response Roster
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <tbody>
                {ON_CALL_TEAM.map((member) => (
                  <tr key={member.id} className="border-b last:border-0 border-zinc-800/50 group">
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold truncate text-zinc-200">{member.name}</span>
                          <span className="text-[9px] uppercase font-bold text-zinc-500 truncate">{member.role}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Support Cases Metrics */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 shadow-sm">
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">{caseTitle || "# Cases Enterprise/Platinum"}</span>
            {caseContent ? caseContent : (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-zinc-100 italic">0</span>
                  <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-tighter">GCP</span>
                </div>
                <div className="w-px h-3 bg-zinc-800" />
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-zinc-100 italic">0</span>
                  <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-tighter">GWS</span>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">{caseTitle2 || "# Cases Total"}</span>
            {caseContent2 ? caseContent2 : (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-zinc-100 italic">0</span>
                  <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-tighter">GCP</span>
                </div>
                <div className="w-px h-3 bg-zinc-800" />
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-zinc-100 italic">0</span>
                  <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-tighter">GWS</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Top Impacted Customers */}
      <AnimatePresence mode="wait">
        {showImpactedCustomers && selectedIncident && (
          <motion.section 
            key={selectedIncident.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-zinc-900 border border-zinc-800 rounded-lg flex flex-col min-h-0 overflow-hidden shadow-xl"
          >
            <div className="p-3 border-b border-zinc-800 bg-zinc-950/50">
              <h2 className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 text-zinc-400">
                <Users size={12} className="text-zinc-500" /> 
                Top Strategic Impacted Customers
              </h2>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto">
              <div className="space-y-2">
                {selectedIncident.impactedCustomers?.map((customer, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded bg-zinc-800/50 border border-zinc-800 hover:border-zinc-700 transition-colors">
                    <div className="w-6 h-6 rounded bg-zinc-900 flex items-center justify-center text-[9px] font-mono text-zinc-500 border border-zinc-800">
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <span className="text-xs font-bold text-zinc-300">{customer}</span>
                  </div>
                ))}
                {(!selectedIncident.impactedCustomers || selectedIncident.impactedCustomers.length === 0) && (
                  <div className="text-[10px] text-zinc-600 italic py-4 text-center">No high-priority customers flagged</div>
                )}
                {selectedIncident.impactedCustomers && selectedIncident.impactedCustomers.length > 0 && (
                  <button className="w-full mt-2 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-300 flex items-center justify-center gap-1 transition-colors border-t border-zinc-800/50 pt-3">
                    View All Impacted Customers <ChevronRight size={12} />
                  </button>
                )}
              </div>
            </div>

            <div className="p-3 bg-red-950/20 border-t border-red-900/30 flex flex-col gap-2">
              <a 
                href="http://go/ocm-panic"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-zinc-100 text-zinc-950 font-bold py-2 rounded text-[10px] uppercase tracking-widest text-center"
              >
                {bridgeTitle}
              </a>
              <button className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded text-[10px] uppercase tracking-widest transition-colors">
                Execute Response Plan
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </aside>
  </div>
);

export default function App() {
  const [incidents] = useState<Incident[]>(MOCK_INCIDENTS);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(MOCK_INCIDENTS[0]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeView, setActiveView] = useState<'CMI' | 'EXEC' | 'OTHER'>('CMI');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getPriorityColor = (p: Priority) => {
    switch (p) {
      case 'Huge':
      case 'Major':
      case 'P0': return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'P1': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'P2': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      default: return 'text-zinc-400 bg-zinc-800 border-zinc-700';
    }
  };

  const getStatusIcon = (s: IncidentStatus) => {
    switch (s) {
      case 'Investigating': return <AlertTriangle className="w-4 h-4 animate-pulse text-red-500" />;
      case 'Monitoring': return <Activity className="w-4 h-4 text-emerald-500" />;
      case 'Resolved': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      default: return <ShieldAlert className="w-4 h-4 text-amber-500" />;
    }
  };
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 font-sans selection:bg-zinc-200 selection:text-zinc-950">
      {/* Top Navigation Rail */}
      <nav className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-zinc-100 rounded flex items-center justify-center text-zinc-950">
              <Terminal size={18} />
            </div>
            <div>
              <h1 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 leading-none">IEM team</h1>
              <p className="font-bold tracking-tight text-lg leading-tight">Critical Incidents and Escalations Comms Dashboard</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            <a href="#" className="hover:text-zinc-100 transition-colors flex items-center gap-2">
              <History size={14} /> Full History
            </a>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end mr-4">
            <span className="text-[9px] uppercase font-mono tracking-tighter text-zinc-600">US/Pacific Time</span>
            <span className="font-mono font-medium text-xs tabular-nums text-zinc-400">
              {currentTime.toLocaleTimeString('en-US', { hour12: false, timeZone: 'America/Los_Angeles' })}
            </span>
          </div>
          <button 
            title="Notification Center - View incident alerts"
            className="p-2 hover:bg-zinc-800 rounded-full relative transition-colors"
          >
            <Bell size={18} className="text-zinc-400" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
          </button>
          <div 
            title="Logged in as Likitha (LK)"
            className="w-8 h-8 rounded border border-zinc-800 bg-zinc-900 flex items-center justify-center font-bold text-zinc-400 text-xs cursor-help"
          >
            LK
          </div>
        </div>
      </nav>
      
      {/* Secondary Webpage Headers */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-6">
        <div className="max-w-[1600px] mx-auto flex">
          <button 
            onClick={() => setActiveView('CMI')}
            className={`px-6 py-3 text-[11px] font-bold uppercase tracking-[0.2em] transition-all relative ${activeView === 'CMI' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            CMI
            {activeView === 'CMI' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-100" />}
          </button>
          <button 
            onClick={() => setActiveView('EXEC')}
            className={`px-6 py-3 text-[11px] font-bold uppercase tracking-[0.2em] transition-all relative ${activeView === 'EXEC' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Exec Escalations
            {activeView === 'EXEC' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-100" />}
          </button>
          <button 
            onClick={() => setActiveView('OTHER')}
            className={`px-6 py-3 text-[11px] font-bold uppercase tracking-[0.2em] transition-all relative ${activeView === 'OTHER' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Other P0/P1 Escalations
            {activeView === 'OTHER' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-100" />}
          </button>
        </div>
      </div>

      <main className="p-4 max-w-[1600px] mx-auto">
        <AnimatePresence mode="wait">
          {activeView === 'CMI' ? (
            <motion.div 
              key="cmi"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <DashboardGrid 
                incidents={incidents}
                selectedIncident={selectedIncident}
                setSelectedIncident={setSelectedIncident}
                getPriorityColor={getPriorityColor}
                getStatusIcon={getStatusIcon}
                bridgeTitle="Social Inbound Cases"
                columnHeaders={{
                  id: "OMG ID",
                  severity: "Severity",
                  status: "Status",
                  service: "service name",
                  location: "regions/Zone affected",
                  updates: "CMI updates"
                }}
              />
            </motion.div>
          ) : activeView === 'EXEC' ? (
            <motion.div 
              key="exec"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <DashboardGrid 
                incidents={incidents}
                selectedIncident={selectedIncident}
                setSelectedIncident={setSelectedIncident}
                getPriorityColor={getPriorityColor}
                getStatusIcon={getStatusIcon}
                showBanner={false}
                sectionTitle="PO Active Exec Esc."
                showCriticalBadge={false}
                showTeam={false}
                showImpactedCustomers={false}
                showCommsBlast={false}
                caseTitle="IEM oncall"
                caseContent={(
                  <div className="mt-1">
                    <a 
                      href="https://oncall.corp.google.com/iem" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded transition-all group"
                    >
                      <PhoneCall size={12} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-mono font-bold text-zinc-200">pravil</span>
                      <ChevronRight size={10} className="text-zinc-600" />
                    </a>
                  </div>
                )}
                caseTitle2="IEM CMIC oncall"
                caseContent2={(
                  <div className="mt-1">
                    <a 
                      href="https://oncall.corp.google.com/iem-cmic" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded transition-all group"
                    >
                      <PhoneCall size={12} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-mono font-bold text-zinc-200">pnmuley</span>
                      <ChevronRight size={10} className="text-zinc-600" />
                    </a>
                  </div>
                )}
                columnHeaders={{
                  poc: "Requesting POC",
                  id: "IEM Bug/Vector Case",
                  severity: "Product Area",
                  status: "Status",
                  service: "Customer name",
                  location: "Issue details",
                  updates: "Exec Updates"
                }}
              />
            </motion.div>
          ) : (
            <motion.div 
              key="other"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col items-center justify-center min-h-[60vh] text-zinc-500 border border-zinc-800 border-dashed rounded-lg bg-zinc-900/20"
            >
              <AlertTriangle size={48} className="mb-4 opacity-20" />
              <h2 className="text-xl font-bold uppercase tracking-[0.2em]">Other P0/P1 Escalations</h2>
              <p className="text-sm opacity-60 mt-2">Monitoring internal P0/P1 service level escalations.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="px-6 py-4 flex justify-between items-center text-[10px] text-zinc-600 border-t border-zinc-800 bg-zinc-950 mt-auto">
        <div className="flex gap-4">
          <span>v4.2.1-RELEASE</span>
          <span className="text-zinc-700 uppercase">|</span>
          <span>AUTHENTICATED: MIM-ADMIN-01</span>
        </div>
        <div className="flex gap-4 font-mono uppercase tracking-tighter">
          <span>API: 12ms</span>
          <span className="text-emerald-500/50">Uptime: 99.98%</span>
          <span>Log: 12.4k/s</span>
        </div>
      </footer>
    </div>
  );
}
