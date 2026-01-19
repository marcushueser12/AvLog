import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ICONS } from '../constants';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const PRICING_TIERS = {
  private: {
    name: 'Private Pack',
    price: 8,
    credits: 10,
    description: 'Perfect for personal logbook digitization',
    popular: false
  },
  commercial: {
    name: 'Commercial Pack',
    price: 16.25,
    credits: 25,
    description: 'Ideal for commercial pilots and flight schools',
    popular: true
  },
  atp: {
    name: 'ATP Pack',
    price: 50,
    credits: 100,
    description: 'Best value for ATP and professional pilots',
    popular: false
  }
};

const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user, getAccessToken } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePurchase = async (packageType: keyof typeof PRICING_TIERS) => {
    if (!user) {
      setError('Please sign in to purchase credits');
      return;
    }

    setLoading(packageType);
    setError(null);

    try {
      const token = getAccessToken();
      if (!token) {
        setError('Authentication required. Please sign in again.');
        return;
      }

      const response = await fetch(`${API_URL}/api/payments/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          packageType
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const data = await response.json();
      
      // Redirect to Stripe Checkout
      // Note: Scans and entries are automatically saved to localStorage via useEffect in App.tsx
      // They will be restored when the user returns from payment
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Failed to start payment. Please try again.');
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md">
      <div className="absolute inset-0 bg-slate-950/80" onClick={onClose}></div>
      <div className="relative bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-white">Purchase Credits</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-600/10 border border-red-600/30 rounded-xl">
            <p className="text-red-400 text-sm font-medium">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Object.entries(PRICING_TIERS).map(([key, tier]) => (
            <div
              key={key}
              className={`relative p-6 rounded-2xl border-2 transition-all ${
                tier.popular
                  ? 'border-blue-500 bg-blue-600/5'
                  : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">
                  MOST POPULAR
                </div>
              )}
              
              <div className="text-center mb-6">
                <h3 className="text-xl font-black text-white mb-2">{tier.name}</h3>
                <div className="mb-2">
                  <span className="text-4xl font-black text-white">${tier.price}</span>
                </div>
                <p className="text-2xl font-bold text-blue-400 mb-1">{tier.credits} Credits</p>
                <p className="text-xs text-slate-500">${(tier.price / tier.credits).toFixed(2)} per credit</p>
              </div>

              <p className="text-sm text-slate-400 text-center mb-6 min-h-[40px]">
                {tier.description}
              </p>

              <button
                onClick={() => handlePurchase(key as keyof typeof PRICING_TIERS)}
                disabled={loading !== null || !user}
                className={`w-full py-3 rounded-xl font-black text-lg transition-all ${
                  tier.popular
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
                    : 'bg-slate-800 hover:bg-slate-700 text-white'
                } disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
              >
                {loading === key ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 7h-4M4 7h4m0 0a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2M8 7v10a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V7M8 7H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"/>
                    </svg>
                    Purchase
                  </>
                )}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-8 p-4 bg-slate-950/50 rounded-xl border border-slate-800">
          <p className="text-xs text-slate-500 text-center">
            Secure payment powered by Stripe. Your payment information is encrypted and secure.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
