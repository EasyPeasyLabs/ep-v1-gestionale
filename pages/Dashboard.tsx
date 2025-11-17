
import React, { useEffect, useState } from 'react';
import { getClients } from '../services/parentService';
import { getSuppliers } from '../services/supplierService';
import Spinner from '../components/Spinner';

const StatCard: React.FC<{ title: string; value: string; change?: string; isPositive?: boolean }> = ({ title, value, change, isPositive }) => (
  <div className="md-card p-6">
    <h3 className="text-sm font-medium" style={{ color: 'var(--md-text-secondary)'}}>{title}</h3>
    <p className="text-3xl font-semibold mt-2" style={{ color: 'var(--md-text-primary)'}}>{value}</p>
    {change && (
      <p className={`text-sm mt-2 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {change} vs mese precedente
      </p>
    )}
  </div>
);

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [clientCount, setClientCount] = useState(0);
  const [supplierCount, setSupplierCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [clients, suppliers] = await Promise.all([
          getClients(),
          getSuppliers()
        ]);
        setClientCount(clients.length);
        setSupplierCount(suppliers.length);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);


  return (
    <div>
      <h1 className="text-3xl font-bold" style={{ color: 'var(--md-text-primary)'}}>Dashboard</h1>
      <p className="mt-1" style={{ color: 'var(--md-text-secondary)'}}>Benvenuta, Ilaria! Ecco una panoramica della tua attività.</p>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
            <StatCard title="Clienti Attivi" value={clientCount.toString()} />
            <StatCard title="Lezioni Erogate (Mese)" value="N/D" />
            <StatCard title="Fornitori" value={supplierCount.toString()} />
            <StatCard title="Tasso di Rinnovo" value="N/D" />
          </div>

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 md-card p-6">
                <h2 className="text-lg font-semibold" style={{ color: 'var(--md-text-primary)'}}>Andamento Iscrizioni</h2>
                <p style={{ color: 'var(--md-text-secondary)'}} className="mt-4">Grafico non ancora implementato.</p>
                <div className="h-64 bg-gray-100 rounded-md mt-4 flex items-center justify-center">
                    <span className="text-gray-400">Chart Area</span>
                </div>
            </div>
            <div className="md-card p-6 flex flex-col">
                <h2 className="text-lg font-semibold" style={{ color: 'var(--md-text-primary)'}}>Prossime Scadenze</h2>
                <div className="flex-grow flex items-center justify-center mt-4">
                    <p className="text-sm" style={{ color: 'var(--md-text-secondary)'}}>Nessuna scadenza imminente.</p>
                </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;