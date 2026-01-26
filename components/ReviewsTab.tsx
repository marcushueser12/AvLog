import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ICONS } from '../constants';
import { Star, MessageSquare, User, Calendar, CheckCircle2, XCircle, AlertCircle, X } from 'lucide-react';
import { motion } from 'framer-motion';

interface Review {
  id: string;
  user_id: string | null;
  reviewer_name: string;
  reviewer_email: string | null;
  rating: number;
  review_text: string;
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
  
  // Form state
  const [formData, setFormData] = useState({
    reviewer_name: user?.user_metadata?.full_name || '',
    reviewer_email: user?.email || '',
    rating: 5,
    review_text: ''
  });

  useEffect(() => {
    loadReviews();
    checkAdminStatus();
  }, [user]);

  const checkAdminStatus = async () => {
    // Check if user is admin (you can customize this logic)
    // For now, we'll use a simple check - you might want to add an admin field to user_profiles
    if (user) {
      try {
        const token = getAccessToken();
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/admin/check`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setIsAdmin(data.isAdmin || false);
          if (data.isAdmin) {
            loadPendingReviews();
          }
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
      }
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

  const loadPendingReviews = async () => {
    if (!isAdmin) return;
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('approved', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingReviews(data || []);
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
        review_text: ''
      });
      
      if (isAdmin) {
        loadPendingReviews();
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

      await loadPendingReviews();
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
                      <p className="font-semibold text-[#003366]">{review.reviewer_name}</p>
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
                      <p className="font-bold text-[#003366]">{review.reviewer_name}</p>
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
