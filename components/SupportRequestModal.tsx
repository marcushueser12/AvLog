import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { X, Send, Loader2, MessageSquare, CheckCircle2, Clock, ChevronDown, ChevronUp } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface SupportTicket {
  id: string;
  request_type: string;
  subject: string;
  message: string;
  status: string;
  admin_response: string | null;
  created_at: string;
  updated_at: string;
}

interface SupportRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SupportRequestModal: React.FC<SupportRequestModalProps> = ({ isOpen, onClose }) => {
  const { user, getAccessToken } = useAuth();
  const [view, setView] = useState<'form' | 'tickets'>('form');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [requestType, setRequestType] = useState<'support' | 'feature'>('support');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTickets = async () => {
    if (!user || !getAccessToken?.()) return;
    setLoadingTickets(true);
    try {
      const token = getAccessToken();
      const response = await fetch(`${API_URL}/api/support/tickets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTickets(data.tickets || []);
      }
    } catch {
      setTickets([]);
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    if (isOpen && user) {
      loadTickets();
      setView('tickets'); // Default to My Tickets for logged-in users so they see their tickets immediately
    } else if (isOpen) {
      setView('form'); // Non-logged-in users see the submit form
    }
  }, [isOpen, user]);

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
      if (user) loadTickets();
      setTimeout(() => {
        setSuccess(false);
        if (user) setView('tickets');
        else onClose();
      }, 2000);
    } catch (err: any) {
      console.error('Error submitting support request:', err);
      setError(err?.message || 'Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      open: 'bg-amber-100 text-amber-800 border-amber-200',
      in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
      resolved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      closed: 'bg-slate-100 text-slate-600 border-slate-200',
    };
    const labels: Record<string, string> = {
      open: 'Open',
      in_progress: 'In Progress',
      resolved: 'Resolved',
      closed: 'Closed',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${colors[status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
        {labels[status] || status}
      </span>
    );
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

        {/* Tabs: New Request / My Tickets (only when logged in) */}
        {user && (
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => { setView('form'); setError(null); }}
              className={`px-4 py-2 rounded-xl font-semibold transition-all border-2 ${
                view === 'form'
                  ? 'bg-[#007BFF]/10 border-[#007BFF] text-[#007BFF]'
                  : 'bg-white border-[#E2E8F0] text-[#003366]/70 hover:border-[#007BFF]/30'
              }`}
            >
              New Request
            </button>
            <button
              onClick={() => { setView('tickets'); setError(null); loadTickets(); }}
              className={`px-4 py-2 rounded-xl font-semibold transition-all border-2 ${
                view === 'tickets'
                  ? 'bg-[#007BFF]/10 border-[#007BFF] text-[#007BFF]'
                  : 'bg-white border-[#E2E8F0] text-[#003366]/70 hover:border-[#007BFF]/30'
              }`}
            >
              My Tickets
            </button>
          </div>
        )}

        {view === 'tickets' && user ? (
          <div className="space-y-4">
            {loadingTickets ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#007BFF]" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-12 text-[#003366]/70">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-[#003366]/20" />
                <p>You haven&apos;t submitted any support requests yet.</p>
                <button
                  onClick={() => setView('form')}
                  className="mt-4 px-4 py-2 bg-[#007BFF] text-white rounded-xl font-semibold hover:bg-[#007BFF]/90"
                >
                  Submit a Request
                </button>
              </div>
            ) : (
              <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="border border-[#E2E8F0] rounded-xl overflow-hidden bg-white"
                  >
                    <button
                      onClick={() => setExpandedTicket(expandedTicket === ticket.id ? null : ticket.id)}
                      className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[#F4F7FA] transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {ticket.request_type === 'feature' ? (
                          <span className="text-[#007BFF] shrink-0">Feature</span>
                        ) : (
                          <span className="text-amber-600 shrink-0">Support</span>
                        )}
                        <span className="font-semibold text-[#003366] truncate">{ticket.subject}</span>
                        {statusBadge(ticket.status)}
                      </div>
                      {expandedTicket === ticket.id ? (
                        <ChevronUp className="w-5 h-5 shrink-0 text-[#003366]/50" />
                      ) : (
                        <ChevronDown className="w-5 h-5 shrink-0 text-[#003366]/50" />
                      )}
                    </button>
                    {expandedTicket === ticket.id && (
                      <div className="px-4 pb-4 pt-0 border-t border-[#E2E8F0]">
                        <p className="text-sm text-[#003366]/80 mt-3">{ticket.message}</p>
                        {ticket.admin_response ? (
                          <div className="mt-4 p-3 bg-[#007BFF]/5 border border-[#007BFF]/20 rounded-xl">
                            <p className="text-xs font-semibold text-[#007BFF] mb-1 flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4" /> Response from support
                            </p>
                            <p className="text-sm text-[#003366] whitespace-pre-wrap">{ticket.admin_response}</p>
                            {ticket.updated_at && (
                              <p className="text-xs text-[#003366]/50 mt-2">
                                Updated {new Date(ticket.updated_at).toLocaleDateString('en-US', {
                                  month: 'short', day: 'numeric', year: 'numeric',
                                  hour: '2-digit', minute: '2-digit'
                                })}
                              </p>
                            )}
                          </div>
                        ) : (ticket.status === 'open' || ticket.status === 'in_progress') && (
                          <p className="mt-4 text-sm text-[#003366]/50 flex items-center gap-2">
                            <Clock className="w-4 h-4" /> Awaiting response from support
                          </p>
                        )}
                        <p className="text-xs text-[#003366]/40 mt-2">
                          Submitted {new Date(ticket.created_at).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric'
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : success ? (
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
            {!user && (
              <p className="text-sm text-[#003366]/60 bg-[#F4F7FA] rounded-xl px-4 py-3 border border-[#E2E8F0]">
                Sign in to view and track your support requests.
              </p>
            )}
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
