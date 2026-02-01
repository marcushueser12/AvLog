import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { X, ShoppingCart, Loader2 } from 'lucide-react';

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
    originalPrice: 8, // Sale from $8 for 10 credits
    credits: 12,
    originalCredits: 10, // Showing sale from 10 credits
    description: 'Perfect for personal logbook digitization',
    popular: false
  },
  commercial: {
    name: 'Commercial Pack',
    price: 12,
    originalPrice: 16.25, // Sale from $16.25 for 25 credits
    credits: 25,
    originalCredits: 25,
    description: 'Ideal for commercial pilots and flight schools',
    popular: true
  },
  atp: {
    name: 'ATP Pack',
    price: 30,
    originalPrice: 50, // Sale from $50 for 100 credits
    credits: 100,
    originalCredits: 100,
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
      
      // Validate and redirect to Stripe Checkout
      // Note: Scans and entries are automatically saved to localStorage via useEffect in App.tsx
      // They will be restored when the user returns from payment
      if (!data.url) {
        throw new Error('No checkout URL received from server');
      }
      
      // Validate URL format
      try {
        const url = new URL(data.url);
        if (!url.protocol.startsWith('http')) {
          throw new Error('Invalid URL protocol');
        }
      } catch (urlError) {
        console.error('Invalid checkout URL:', data.url);
        throw new Error('Invalid checkout URL received. Please try again or contact support.');
      }
      
      // Save payment redirect flag before redirecting
      localStorage.setItem('pending_payment_redirect', 'true');
      
      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Failed to start payment. Please try again.');
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
      <div className="relative bg-white/90 backdrop-blur-md border border-[#E2E8F0] rounded-3xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-[#003366]">Purchase Credits</h2>
          <button
            onClick={onClose}
            className="text-[#003366]/60 hover:text-[#003366] transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-xl">
            <p className="text-red-600 text-sm font-medium">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Object.entries(PRICING_TIERS).map(([key, tier]) => (
            <div
              key={key}
              className={`relative p-6 rounded-2xl border-2 transition-all shadow-sm hover:shadow-md ${
                tier.popular
                  ? 'border-[#007BFF] bg-[#007BFF]/5'
                  : 'border-[#E2E8F0] bg-white/80 hover:border-[#007BFF]/30'
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#007BFF] text-white text-xs font-bold rounded-full">
                  MOST POPULAR
                </div>
              )}
              
              <div className="text-center mb-6">
                <h3 className="text-xl font-black text-[#003366] mb-2">{tier.name}</h3>
                <div className="mb-2">
                  {tier.originalPrice > tier.price && (
                    <div className="mb-1">
                      <span className="text-sm text-[#003366]/60 line-through mr-2">${tier.originalPrice}</span>
                      <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">SALE</span>
                    </div>
                  )}
                  <span className="text-4xl font-black text-[#003366]">${tier.price}</span>
                </div>
                <p className="text-2xl font-bold text-[#007BFF] mb-1">{tier.credits} Credits</p>
                {tier.originalPrice > tier.price && (
                  <p className="text-xs text-[#003366]/60 mb-1">
                    <span className="line-through">${(tier.originalPrice / tier.originalCredits).toFixed(2)}</span>
                    {' '}→ ${(tier.price / tier.credits).toFixed(2)} per credit
                  </p>
                )}
                {tier.originalPrice === tier.price && (
                  <p className="text-xs text-[#003366]/60">${(tier.price / tier.credits).toFixed(2)} per credit</p>
                )}
              </div>

              <p className="text-sm text-[#003366]/70 text-center mb-6 min-h-[40px]">
                {tier.description}
              </p>

              <button
                onClick={() => handlePurchase(key as keyof typeof PRICING_TIERS)}
                disabled={loading !== null || !user}
                className={`w-full py-3 rounded-xl font-bold text-lg transition-all ${
                  tier.popular
                    ? 'bg-[#003366] hover:bg-[#003366]/90 text-white shadow-lg shadow-[#003366]/20 shiny-button'
                    : 'bg-white border-2 border-[#E2E8F0] hover:border-[#007BFF] text-[#003366] hover:text-[#007BFF]'
                } disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
              >
                {loading === key ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-5 h-5" />
                    Purchase
                  </>
                )}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-8 p-4 bg-[#F4F7FA] rounded-xl border border-[#E2E8F0]">
          <p className="text-xs text-[#003366]/60 text-center">
            Secure payment powered by Stripe. Your payment information is encrypted and secure.
          </p>
          <p className="text-xs text-[#003366]/60 text-center mt-2">
            Need a refund? Contact support and we&apos;ll be happy to help.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
