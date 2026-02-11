"use client";

import { useState, useEffect } from "react";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (feedback: FeedbackData) => Promise<void>;
  userTier?: "free" | "pro" | "enterprise";
}

interface FeedbackData {
  npsScore: number | null;
  npsFollowup: string;
  improvement: string;
  categories: string[];
  featureRequest: string;
}

const CATEGORIES = [
  { id: "developer-tools", label: "Developer tools (APIs, CLIs, dev productivity)" },
  { id: "saas", label: "SaaS / B2B (business software, workflows)" },
  { id: "consumer", label: "Consumer apps (mobile, social, lifestyle)" },
  { id: "ai-ml", label: "AI / ML (applications using AI/ML)" },
  { id: "ecommerce", label: "E-commerce / Marketplaces" },
  { id: "fintech", label: "Fintech (payments, banking, investing)" },
  { id: "health", label: "Health / Wellness" },
  { id: "education", label: "Education / Learning" },
];

export default function FeedbackModal({
  isOpen,
  onClose,
  onSubmit,
  userTier = "free",
}: FeedbackModalProps) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackData>({
    npsScore: null,
    npsFollowup: "",
    improvement: "",
    categories: [],
    featureRequest: "",
  });

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setFeedback({
        npsScore: null,
        npsFollowup: "",
        improvement: "",
        categories: [],
        featureRequest: "",
      });
    }
  }, [isOpen]);

  const handleNpsClick = (score: number) => {
    setFeedback((prev) => ({ ...prev, npsScore: score }));
  };

  const handleCategoryToggle = (categoryId: string) => {
    setFeedback((prev) => ({
      ...prev,
      categories: prev.categories.includes(categoryId)
        ? prev.categories.filter((c) => c !== categoryId)
        : [...prev.categories, categoryId],
    }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit(feedback);
      onClose();
    } catch (error) {
      console.error("Failed to submit feedback:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getNpsFollowupText = () => {
    if (feedback.npsScore === null) return "";
    if (feedback.npsScore <= 6) return "We're sorry to hear that. What's the #1 thing we could do better?";
    if (feedback.npsScore <= 8) return "Thanks! What would make you rate us higher?";
    return "Awesome! What do you love most about ZeroToShip?";
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Help Us Improve
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`w-2 h-2 rounded-full ${
                  step >= s ? "bg-primary-500" : "bg-gray-300 dark:bg-gray-600"
                }`}
              />
            ))}
          </div>

          {/* Step 1: NPS */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                  How likely are you to recommend ZeroToShip to a friend or colleague?
                </label>
                <div className="flex items-center justify-between gap-1">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                    <button
                      key={score}
                      onClick={() => handleNpsClick(score)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                        feedback.npsScore === score
                          ? "bg-primary-500 text-white"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                      }`}
                    >
                      {score}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>Not likely</span>
                  <span>Very likely</span>
                </div>
              </div>

              {feedback.npsScore !== null && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {getNpsFollowupText()}
                  </label>
                  <textarea
                    value={feedback.npsFollowup}
                    onChange={(e) => setFeedback((prev) => ({ ...prev, npsFollowup: e.target.value }))}
                    placeholder="Your thoughts..."
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 2: Improvement & Categories */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  What&apos;s the #1 thing we could improve?
                </label>
                <textarea
                  value={feedback.improvement}
                  onChange={(e) => setFeedback((prev) => ({ ...prev, improvement: e.target.value }))}
                  placeholder="e.g., More ideas in the AI/ML category or Faster email delivery"
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  What types of ideas interest you most?
                </label>
                <div className="space-y-2">
                  {CATEGORIES.map((category) => (
                    <label
                      key={category.id}
                      className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={feedback.categories.includes(category.id)}
                        onChange={() => handleCategoryToggle(category.id)}
                        className="mt-0.5 w-4 h-4 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {category.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Feature Request */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  What feature would make ZeroToShip 10x more valuable for you?
                </label>
                <textarea
                  value={feedback.featureRequest}
                  onChange={(e) => setFeedback((prev) => ({ ...prev, featureRequest: e.target.value }))}
                  placeholder="e.g., Integration with Notion or Mobile app (optional)"
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Summary */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Your Feedback Summary
                </h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>NPS Score: {feedback.npsScore}/10</li>
                  {feedback.categories.length > 0 && (
                    <li>Categories: {feedback.categories.length} selected</li>
                  )}
                  {feedback.improvement && <li>Improvement suggestion provided</li>}
                  {feedback.featureRequest && <li>Feature request provided</li>}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          {step > 1 ? (
            <button
              onClick={() => setStep((prev) => prev - 1)}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Back
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Skip
            </button>
          )}

          {step < 3 ? (
            <button
              onClick={() => setStep((prev) => prev + 1)}
              disabled={step === 1 && feedback.npsScore === null}
              className="px-6 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {isSubmitting ? "Submitting..." : "Submit Feedback"}
            </button>
          )}
        </div>

        {/* Pro upgrade CTA for free users */}
        {userTier === "free" && step === 3 && (
          <div className="px-6 pb-6">
            <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4 text-center">
              <p className="text-sm text-primary-700 dark:text-primary-300">
                Want to help even more?{" "}
                <a href="/signup?plan=pro" className="font-medium underline">
                  Upgrade to Builder
                </a>{" "}
                and get 10 full briefs daily.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Hook to manage feedback modal visibility
export function useFeedbackModal() {
  const [isOpen, setIsOpen] = useState(false);

  const shouldShowFeedback = (daysSinceSignup: number, ideasViewed: number): boolean => {
    // Show after 7 days OR after viewing 10+ ideas
    // Check localStorage to avoid showing too frequently
    const lastShown = localStorage.getItem("feedback_last_shown");
    if (lastShown) {
      const daysSinceLastShown = (Date.now() - parseInt(lastShown)) / (1000 * 60 * 60 * 24);
      if (daysSinceLastShown < 30) return false;
    }

    return daysSinceSignup >= 7 || ideasViewed >= 10;
  };

  const markAsShown = () => {
    localStorage.setItem("feedback_last_shown", Date.now().toString());
  };

  const openModal = () => setIsOpen(true);
  const closeModal = () => {
    setIsOpen(false);
    markAsShown();
  };

  return {
    isOpen,
    openModal,
    closeModal,
    shouldShowFeedback,
  };
}
