import React from 'react';
import { X, MessageSquare, Star } from 'lucide-react';

const MILESTONE_2_KEY = 'logextract_review_prompt_dismissed_2';
const MILESTONE_10_KEY = 'logextract_review_prompt_dismissed_10';

export type ReviewPromptMilestone = 2 | 10;

function getDismissed(milestone: ReviewPromptMilestone): boolean {
  try {
    const key = milestone === 2 ? MILESTONE_2_KEY : MILESTONE_10_KEY;
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

/** True if we should show the review prompt for the given permanent log page count. */
export function shouldShowReviewPrompt(count: number): boolean {
  if (count >= 10 && !getDismissed(10)) return true;
  if (count >= 2 && !getDismissed(2)) return true;
  return false;
}

/** Which milestone we're currently prompting for (highest applicable). */
export function getReviewPromptMilestone(count: number): ReviewPromptMilestone | null {
  if (count >= 10 && !getDismissed(10)) return 10;
  if (count >= 2 && !getDismissed(2)) return 2;
  return null;
}

export function setReviewPromptDismissed(milestone: ReviewPromptMilestone): void {
  try {
    const key = milestone === 2 ? MILESTONE_2_KEY : MILESTONE_10_KEY;
    localStorage.setItem(key, '1');
  } catch {
    // ignore
  }
}

interface ReviewPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeaveReview: () => void;
}

const ReviewPromptModal: React.FC<ReviewPromptModalProps> = ({ isOpen, onClose, onLeaveReview }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div
        className="bg-white/95 backdrop-blur-md border border-[#E2E8F0] rounded-2xl p-8 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2 text-[#007BFF]">
            <div className="p-2 rounded-xl bg-[#007BFF]/10">
              <MessageSquare className="w-6 h-6" />
            </div>
            <span className="text-sm font-semibold text-[#003366]/70">Thank you for using Log Extract</span>
          </div>
          <button
            onClick={onClose}
            className="text-[#003366]/60 hover:text-[#003366] transition-colors p-1"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <h2 className="text-xl font-bold text-[#003366] mb-2">
          Loving Log Extract?
        </h2>
        <p className="text-[#003366]/80 mb-6">
          Leave a review and tell fellow pilots how Log Extract helps you digitize your logbook. Your experience can help others find the tool.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onLeaveReview}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#007BFF] hover:bg-[#0066CC] text-white font-semibold rounded-xl transition-all shadow-sm hover:shadow-md"
          >
            <Star className="w-4 h-4 fill-current" />
            Leave a review
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-[#F4F7FA] hover:bg-[#E2E8F0] text-[#003366]/80 font-medium rounded-xl transition-all border border-[#E2E8F0]"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReviewPromptModal;
