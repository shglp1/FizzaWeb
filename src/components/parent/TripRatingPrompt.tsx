'use client';

import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { Button, Alert, Textarea } from '@/components/ui';

type Props = {
  tripId: string;
  driverName?: string;
  onRated?: () => void;
};

export function TripRatingPrompt({ tripId, driverName, onRated }: Props) {
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [reason, setReason] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let cancelled = false;
    setChecking(true);
    fetch(`/api/trips/${tripId}/rating`)
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        if (res.data?.eligible) {
          setEligible(true);
        } else {
          setEligible(false);
          setReason(res.data?.reason ?? '');
        }
      })
      .catch(() => {
        if (!cancelled) setEligible(false);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => { cancelled = true; };
  }, [tripId]);

  if (checking) return null;
  if (!eligible) {
    if (reason === 'Already rated') {
      return (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800 font-medium">
          Rated — thank you for your feedback
        </div>
      );
    }
    return null;
  }

  async function submit() {
    if (rating < 1) {
      setError('Please select a star rating.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/trips/${tripId}/rating`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment: comment.trim() || undefined }),
      });
      const json = await res.json();
      if (json.data) {
        setSuccess('Thank you for your feedback!');
        setEligible(false);
        onRated?.();
      } else {
        setError(json.error?.message ?? 'Could not submit rating.');
      }
    } catch {
      setError('Unable to submit rating.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800 font-medium">
        Rated — thank you for your feedback
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 space-y-3">
      <p className="text-sm font-semibold text-gray-900">
        Rate your experience{driverName ? ` with ${driverName}` : ''}
      </p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className="p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
            onClick={() => setRating(n)}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
          >
            <Star
              className={`h-7 w-7 ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
              aria-hidden
            />
          </button>
        ))}
      </div>
      <Textarea
        label="Comment (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="Tell us about the service…"
      />
      {error && <Alert variant="error">{error}</Alert>}
      <Button variant="primary" size="sm" loading={loading} onClick={submit}>
        Submit rating
      </Button>
    </div>
  );
}
