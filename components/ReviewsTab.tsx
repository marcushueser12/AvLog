import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ICONS } from '../constants';
import { Star, MessageSquare, User, Calendar, CheckCircle2, XCircle, AlertCircle, X, Send, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface SupportTicket {
  id: string;
  user_id: string | null;
  user_email: string | null;
  request_type: string;
  subject: string;
  message: string;
  status: string;
  admin_notes: string | null;
  admin_response: string | null;
  created_at: string;
  updated_at: string;
}

interface Review {
  id: string;
  user_id: string | null;
  reviewer_name: string;
  reviewer_email: string | null;
  rating: number;
  review_text: string;
  pilot_ratings: string | null;
  approved: boolean;
  created_at: string;
  updated_at: string;
}

const ReviewsTab: React.FC = () => {
  const { user, getAccessToken } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingReviews, setPendingReviews] = useState<Review[]>([]);
  const [featuredReviews, setFeaturedReviews] = useState<Review[]>([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [loadingSupportTickets, setLoadingSupportTickets] = useState(false);
  const [supportStatusFilter, setSupportStatusFilter] = useState<string>('open');
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [respondTicketId, setRespondTicketId] = useState<string | null>(null);
  const [respondText, setRespondText] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [submittingRespond, setSubmittingRespond] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    reviewer_name: user?.user_metadata?.full_name || '',
    reviewer_email: user?.email || '',
    rating: 5,
    review_text: '',
    pilot_ratings: ''
  });

  useEffect(() => {
    loadReviews();
    loadFeaturedReviews();
    if (user) {
      checkAdminStatus();
    } else {
      setIsAdmin(false);
      setPendingReviews([]);
    }
  }, [user]);
  
  // Reload pending reviews when isAdmin changes
  useEffect(() => {
    if (isAdmin) {
      loadPendingReviews(true);
      loadSupportTickets();
    } else {
      setPendingReviews([]);
      setSupportTickets([]);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      loadSupportTickets();
    }
  }, [supportStatusFilter]);

  const checkAdminStatus = async () => {
    if (user) {
      try {
        const token = getAccessToken();
        if (!token) {
          setIsAdmin(false);
          return;
        }
        
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/admin/check`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          const adminStatus = data.isAdmin || false;
          setIsAdmin(adminStatus);
          
          // Log for debugging
          if (process.env.NODE_ENV === 'development') {
            console.log('Admin status check result:', {
              userEmail: user.email,
              isAdmin: adminStatus,
              response: data
            });
          }
          
          // Force load pending reviews if admin (bypass isAdmin check since state update is async)
          if (adminStatus) {
            loadPendingReviews(true);
          } else {
            setPendingReviews([]);
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('Admin check failed:', response.status, errorData);
          setIsAdmin(false);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      }
    } else {
      setIsAdmin(false);
    }
  };

  const loadReviews = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('approved', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReviews(data || []);
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFeaturedReviews = async () => {
    try {
      setLoadingFeatured(true);
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('approved', true)
        .order('rating', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) throw error;
      setFeaturedReviews(data || []);
    } catch (error) {
      console.error('Error loading featured reviews:', error);
    } finally {
      setLoadingFeatured(false);
    }
  };

  const loadSupportTickets = async () => {
    if (!isAdmin) return;
    setLoadingSupportTickets(true);
    try {
      const token = getAccessToken();
      if (!token) return;
      const url = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/admin/support-tickets${supportStatusFilter ? `?status=${supportStatusFilter}` : ''}`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) {
        const data = await response.json();
        setSupportTickets(data.tickets || []);
      }
    } catch (error) {
      console.error('Error loading support tickets:', error);
    } finally {
      setLoadingSupportTickets(false);
    }
  };

  const handleRespondToTicket = async (ticketId: string) => {
    try {
      setSubmittingRespond(true);
      const token = getAccessToken();
      if (!token) return;
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/admin/support-tickets/${ticketId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ response: respondText, internalNotes: internalNotes || undefined }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to respond');
      }
      setRespondTicketId(null);
      setRespondText('');
      setInternalNotes('');
      loadSupportTickets();
    } catch (error: any) {
      alert(error.message || 'Failed to respond to ticket');
    } finally {
      setSubmittingRespond(false);
    }
  };

  const handleUpdateTicketStatus = async (ticketId: string, status: string) => {
    try {
      const token = getAccessToken();
      if (!token) return;
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/admin/support-tickets/${ticketId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update status');
      }
      loadSupportTickets();
    } catch (error: any) {
      alert(error.message || 'Failed to update status');
    }
  };

  const loadPendingReviews = async (forceLoad = false) => {
    // Allow force loading even if isAdmin isn't set yet (for async state updates)
    if (!isAdmin && !forceLoad) return;
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('approved', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingReviews(data || []);
      
      // Log for debugging
      if (process.env.NODE_ENV === 'development') {
        console.log('Loaded pending reviews:', data?.length || 0);
      }
    } catch (error) {
      console.error('Error loading pending reviews:', error);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.reviewer_name.trim() || !formData.review_text.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      const { data, error } = await supabase
        .from('reviews')
        .insert([
          {
            user_id: user?.id || null, // Allow anonymous reviews
            reviewer_name: formData.reviewer_name.trim(),
            reviewer_email: formData.reviewer_email.trim() || null,
            rating: formData.rating,
            review_text: formData.review_text.trim(),
            pilot_ratings: formData.pilot_ratings.trim() || null,
            approved: false // Requires admin approval
          }
        ])
        .select()
        .single();

      if (error) throw error;

      alert('Thank you for your review! It will be published after admin approval.');
      setShowSubmitForm(false);
      setFormData({
        reviewer_name: user?.user_metadata?.full_name || '',
        reviewer_email: user?.email || '',
        rating: 5,
        review_text: '',
        pilot_ratings: ''
      });
      
      if (isAdmin) {
        loadPendingReviews(true);
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      alert('Error submitting review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveReview = async (reviewId: string, approve: boolean) => {
    try {
      const token = getAccessToken();
      if (!token) {
        alert('Please sign in to approve reviews');
        return;
      }
      
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/admin/approve-review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          // Admin token should NOT be client-side - removed for security
          // Admin access is verified server-side via ADMIN_EMAILS or ADMIN_SECRET_TOKEN
        },
        body: JSON.stringify({ reviewId, approve })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to update review' }));
        throw new Error(errorData.error || 'Failed to update review');
      }

      await loadPendingReviews(true);
      await loadReviews();
    } catch (error: any) {
      console.error('Error approving review:', error);
      alert(error.message || 'Error updating review. Please try again.');
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-5 h-5 ${
          i < rating
            ? 'text-amber-400 fill-amber-400'
            : 'text-gray-300'
        }`}
      />
    ));
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#007BFF] mx-auto mb-4"></div>
          <p className="text-[#003366]/70">Loading reviews...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-[#F4F7FA]">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-black text-[#003366] mb-2">What Pilots Say</h1>
          <p className="text-[#003366]/70 text-sm sm:text-base">
            Real feedback from pilots using LogExtract to digitize their logbooks
          </p>
        </div>

        {/* Featured Reviews Section */}
        {!loadingFeatured && featuredReviews.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl sm:text-2xl font-black text-[#003366] mb-4 tracking-tight">
              Featured Reviews
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {featuredReviews.map((review, index) => (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-xl p-5 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${
                            i < review.rating
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-[#003366] mb-2">
                    {review.reviewer_name}
                    {review.pilot_ratings && (
                      <span className="text-[#003366]/60 font-normal">
                        {' • '}{review.pilot_ratings}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-[#003366]/70 leading-relaxed line-clamp-4">
                    {review.review_text}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Submit Review Button */}
        {!showSubmitForm && (
          <div className="mb-8">
            <button
              onClick={() => setShowSubmitForm(true)}
              className="px-6 py-3 bg-[#003366] hover:bg-[#003366]/90 text-white rounded-xl font-bold transition-all shadow-lg shadow-[#003366]/20 shiny-button min-h-[48px]"
            >
              <MessageSquare className="w-5 h-5 inline mr-2" />
              Write a Review
            </button>
            {!user && (
              <p className="text-sm text-[#003366]/60 mt-2 italic">
                No account needed to view or submit reviews
              </p>
            )}
          </div>
        )}

        {/* Submit Review Form */}
        {showSubmitForm && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-2xl p-6 shadow-lg"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-[#003366]">Submit Your Review</h2>
              <button
                onClick={() => setShowSubmitForm(false)}
                className="text-[#003366]/50 hover:text-[#003366] transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmitReview} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#003366] mb-2">
                  Your Name *
                </label>
                <input
                  type="text"
                  value={formData.reviewer_name}
                  onChange={(e) => setFormData({ ...formData, reviewer_name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] outline-none"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#003366] mb-2">
                  Email (optional)
                </label>
                <input
                  type="email"
                  value={formData.reviewer_email}
                  onChange={(e) => setFormData({ ...formData, reviewer_email: e.target.value })}
                  className="w-full px-4 py-2 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] outline-none"
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#003366] mb-2">
                  Your Ratings (optional)
                </label>
                <input
                  type="text"
                  value={formData.pilot_ratings}
                  onChange={(e) => setFormData({ ...formData, pilot_ratings: e.target.value })}
                  className="w-full px-4 py-2 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] outline-none"
                  placeholder="e.g., Instrument Pilot, Commercial Pilot, CFI"
                />
                <p className="text-xs text-[#003366]/60 mt-1">
                  Include your certifications or ratings to add credibility (e.g., "Instrument Pilot", "Commercial Pilot", "CFI", "ATP")
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#003366] mb-2">
                  Rating *
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => setFormData({ ...formData, rating })}
                      className="focus:outline-none"
                    >
                      <Star
                        className={`w-8 h-8 transition-all ${
                          rating <= formData.rating
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-gray-300 hover:text-amber-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#003366] mb-2">
                  Your Review *
                </label>
                <textarea
                  value={formData.review_text}
                  onChange={(e) => setFormData({ ...formData, review_text: e.target.value })}
                  required
                  rows={5}
                  className="w-full px-4 py-2 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] outline-none resize-none"
                  placeholder="Share your experience with LogExtract..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-[#003366] hover:bg-[#003366]/90 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
                >
                  {submitting ? 'Submitting...' : 'Submit Review'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSubmitForm(false)}
                  className="px-6 py-2 bg-white border border-[#E2E8F0] hover:bg-[#F4F7FA] text-[#003366] rounded-lg font-semibold transition-all min-h-[48px]"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Admin Support Tickets Section */}
        {isAdmin && (
          <div className="mb-8 bg-blue-50 border border-blue-200 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-[#003366] mb-4 flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-[#007BFF]" />
              Support Tickets
            </h2>
            <div className="flex gap-2 mb-4">
              {['open', 'in_progress', 'resolved', 'closed'].map((s) => (
                <button
                  key={s}
                  onClick={() => setSupportStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    supportStatusFilter === s
                      ? 'bg-[#007BFF] text-white'
                      : 'bg-white border border-blue-200 text-[#003366]/70 hover:bg-blue-100'
                  }`}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
            {loadingSupportTickets ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#007BFF]" />
              </div>
            ) : supportTickets.length === 0 ? (
              <p className="text-[#003366]/60 py-4">No tickets in this status.</p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {supportTickets.map((ticket) => (
                  <div key={ticket.id} className="bg-white border border-blue-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setExpandedTicket(expandedTicket === ticket.id ? null : ticket.id)}
                        className="flex-1 text-left min-w-0"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            ticket.request_type === 'feature' ? 'bg-purple-100 text-purple-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {ticket.request_type}
                          </span>
                          <span className="font-semibold text-[#003366] truncate">{ticket.subject}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            ticket.status === 'resolved' || ticket.status === 'closed' ? 'bg-emerald-100 text-emerald-800' :
                            ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {ticket.status}
                          </span>
                        </div>
                        {ticket.user_email && (
                          <p className="text-xs text-[#003366]/50 mt-1">{ticket.user_email}</p>
                        )}
                      </button>
                      <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {ticket.status !== 'in_progress' && ticket.status !== 'resolved' && ticket.status !== 'closed' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleUpdateTicketStatus(ticket.id, 'in_progress'); }}
                            className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          >
                            Start
                          </button>
                        )}
                        {ticket.status !== 'resolved' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleUpdateTicketStatus(ticket.id, 'resolved'); }}
                            className="px-2 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200"
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </div>
                    {expandedTicket === ticket.id && (
                      <div className="px-4 pb-4 pt-0 border-t border-blue-100">
                        <p className="text-sm text-[#003366]/80 mt-3 whitespace-pre-wrap">{ticket.message}</p>
                        {ticket.admin_response && (
                          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                            <p className="text-xs font-semibold text-[#007BFF] mb-1">Your response to user:</p>
                            <p className="text-sm text-[#003366] whitespace-pre-wrap">{ticket.admin_response}</p>
                          </div>
                        )}
                        {respondTicketId === ticket.id ? (
                          <div className="mt-4 space-y-3">
                            <div>
                              <label className="block text-xs font-semibold text-[#003366] mb-1">Response (visible to user)</label>
                              <textarea
                                value={respondText}
                                onChange={(e) => setRespondText(e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm"
                                placeholder="Write your response to the user..."
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-[#003366] mb-1">Internal notes (admin only)</label>
                              <textarea
                                value={internalNotes}
                                onChange={(e) => setInternalNotes(e.target.value)}
                                rows={2}
                                className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm"
                                placeholder="Private notes (not shown to user)"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleRespondToTicket(ticket.id)}
                                disabled={!respondText.trim() || submittingRespond}
                                className="px-4 py-2 bg-[#007BFF] text-white rounded-lg font-semibold text-sm hover:bg-[#007BFF]/90 disabled:opacity-50 flex items-center gap-2"
                              >
                                {submittingRespond ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                Send Response
                              </button>
                              <button
                                onClick={() => { setRespondTicketId(null); setRespondText(''); setInternalNotes(''); }}
                                className="px-4 py-2 bg-white border border-[#E2E8F0] text-[#003366] rounded-lg font-semibold text-sm hover:bg-[#F4F7FA]"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setRespondTicketId(ticket.id); setRespondText(ticket.admin_response || ''); setInternalNotes(ticket.admin_notes || ''); }}
                            className="mt-3 px-3 py-2 bg-[#007BFF]/10 text-[#007BFF] rounded-lg font-semibold text-sm hover:bg-[#007BFF]/20 flex items-center gap-2"
                          >
                            <Send className="w-4 h-4" />
                            {ticket.admin_response ? 'Edit Response' : 'Respond'}
                          </button>
                        )}
                        <p className="text-xs text-[#003366]/40 mt-2">
                          Submitted {new Date(ticket.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Admin Pending Reviews Section */}
        {isAdmin && pendingReviews.length > 0 && (
          <div className="mb-8 bg-amber-50 border border-amber-200 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-[#003366] mb-4 flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-amber-600" />
              Pending Reviews ({pendingReviews.length})
            </h2>
            <div className="space-y-4">
              {pendingReviews.map((review) => (
                <div
                  key={review.id}
                  className="bg-white border border-amber-200 rounded-xl p-4"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-[#003366]">
                        {review.reviewer_name}
                        {review.pilot_ratings && (
                          <span className="text-[#003366]/60 font-normal">
                            {' • '}{review.pilot_ratings}
                          </span>
                        )}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {renderStars(review.rating)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveReview(review.id, true)}
                        className="p-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg transition-colors"
                        title="Approve"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleApproveReview(review.id, false)}
                        className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
                        title="Reject"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-[#003366]/70">{review.review_text}</p>
                  {review.reviewer_email && (
                    <p className="text-xs text-[#003366]/50 mt-2">{review.reviewer_email}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reviews Grid */}
        {reviews.length === 0 ? (
          <div className="text-center py-12 bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-2xl">
            <MessageSquare className="w-12 h-12 text-[#003366]/20 mx-auto mb-4" />
            <p className="text-[#003366]/70">No reviews yet. Be the first to share your experience!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reviews.map((review) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#007BFF]/10 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-[#007BFF]" />
                    </div>
                    <div>
                      <p className="font-bold text-[#003366]">
                        {review.reviewer_name}
                        {review.pilot_ratings && (
                          <span className="text-[#003366]/60 font-normal">
                            {' • '}{review.pilot_ratings}
                          </span>
                        )}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        {renderStars(review.rating)}
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-[#003366]/70 leading-relaxed mb-4">
                  {review.review_text}
                </p>
                <div className="flex items-center gap-2 text-xs text-[#003366]/50">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {new Date(review.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewsTab;
