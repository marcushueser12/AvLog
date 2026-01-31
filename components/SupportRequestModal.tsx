import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { X, Send, Loader2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface SupportRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SupportRequestModal: React.FC<SupportRequestModalProps> = ({ isOpen, onClose }) => {
  const { user, getAccessToken } = useAuth();
  const [requestType, setRequestType] = useState<'support' | 'feature'>('support');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subject.trim() || !message.trim()) {
      setError('Please fill in all fields');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      const token = getAccessToken?.();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/api/support`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          requestType,
          subject: subject.trim(),
          message: message.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `Request failed (${response.status})`);
      }

      setSuccess(true);
      setSubject('');
      setMessage('');
      
      // Close modal after 2 seconds
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error('Error submitting support request:', err);
      setError(err?.message || 'Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div 
        className="bg-white/90 backdrop-blur-md border border-[#E2E8F0] rounded-2xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-[#003366]">Support & Feature Requests</h2>
          <button
            onClick={onClose}
            className="text-[#003366]/60 hover:text-[#003366] transition-colors"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {success ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Send className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-[#003366] mb-2">Request Submitted!</h3>
            <p className="text-[#003366]/70">
              Thank you for your feedback. We'll get back to you soon.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Request Type Selection */}
            <div>
              <label className="block text-sm font-semibold text-[#003366] mb-2">
                Request Type
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setRequestType('support')}
                  className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all border-2 ${
                    requestType === 'support'
                      ? 'bg-[#007BFF]/10 border-[#007BFF] text-[#007BFF]'
                      : 'bg-white border-[#E2E8F0] text-[#003366]/70 hover:border-[#007BFF]/30'
                  }`}
                >
                  Support Request
                </button>
                <button
                  type="button"
                  onClick={() => setRequestType('feature')}
                  className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all border-2 ${
                    requestType === 'feature'
                      ? 'bg-[#007BFF]/10 border-[#007BFF] text-[#007BFF]'
                      : 'bg-white border-[#E2E8F0] text-[#003366]/70 hover:border-[#007BFF]/30'
                  }`}
                >
                  Feature Request
                </button>
              </div>
            </div>

            {/* Subject */}
            <div>
              <label htmlFor="subject" className="block text-sm font-semibold text-[#003366] mb-2">
                Subject
              </label>
              <input
                id="subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={requestType === 'support' ? 'Brief description of your issue' : 'Feature idea title'}
                className="w-full px-4 py-3 bg-white border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-transparent text-[#003366]"
                required
                maxLength={200}
              />
            </div>

            {/* Message */}
            <div>
              <label htmlFor="message" className="block text-sm font-semibold text-[#003366] mb-2">
                {requestType === 'support' ? 'Details' : 'Description'}
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={requestType === 'support' ? 'Please describe your issue in detail...' : 'Tell us about your feature idea...'}
                rows={6}
                className="w-full px-4 py-3 bg-white border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-transparent text-[#003366] resize-none"
                required
                maxLength={2000}
              />
              <p className="text-xs text-[#003366]/60 mt-1">
                {message.length}/2000 characters
              </p>
            </div>

            {error && (
              <div className="p-4 bg-red-100 border border-red-300 rounded-xl">
                <p className="text-red-600 text-sm font-medium">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 bg-white border-2 border-[#E2E8F0] text-[#003366] rounded-xl font-semibold transition-all hover:border-[#003366]/30"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !subject.trim() || !message.trim()}
                className="flex-1 px-6 py-3 bg-[#003366] hover:bg-[#003366]/90 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all shadow-lg shadow-[#003366]/20 flex items-center justify-center gap-2 shiny-button"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Submit Request
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default SupportRequestModal;
