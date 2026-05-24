'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Send, ImagePlus, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui';
import { tripService } from '@/services/tripService';
import { DRIVER_QUICK_REPLIES, PARENT_QUICK_REPLIES } from '@/lib/trips/chatModeration';
import {
  CHAT_BLOCKED_LABEL,
  CHAT_UNAVAILABLE_BEFORE_LABEL,
  fmtDriverTime,
  truncateRouteLabel,
} from '@/lib/ui/driverPortal';

type ChatMessage = {
  id: string;
  senderUserId: string;
  senderRole: string;
  messageType: string;
  body: string;
  attachmentUrl: string | null;
  createdAt: string;
};

type TripChatDrawerProps = {
  open: boolean;
  onClose: () => void;
  tripId: string;
  userRole: 'DRIVER' | 'PARENT' | string;
  tripSummary: {
    riderName: string;
    pickup: string;
    dropoff: string;
    scheduledPickupTime: string | null;
    parentName?: string;
  };
};

export function TripChatDrawer({ open, onClose, tripId, userRole, tripSummary }: TripChatDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [windowOpen, setWindowOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [closedReason, setClosedReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const quickReplies = userRole === 'DRIVER' ? DRIVER_QUICK_REPLIES : PARENT_QUICK_REPLIES;

  const loadChat = useCallback(async () => {
    const res = await tripService.getChat(tripId);
    if (res.data) {
      setMessages(res.data.messages ?? []);
      setWindowOpen(!!res.data.windowOpen);
      setBlocked(false);
      setClosedReason(res.data.windowOpen ? null : CHAT_UNAVAILABLE_BEFORE_LABEL);
    } else if (res.error?.message?.includes('restricted')) {
      setBlocked(true);
      setWindowOpen(false);
    } else {
      setError(res.error?.message ?? 'Could not load chat.');
    }
    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    loadChat();
    const id = setInterval(loadChat, 5000);
    return () => clearInterval(id);
  }, [open, loadChat]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  async function sendMessage(body: string, messageType: 'TEXT' | 'QUICK_REPLY' | 'IMAGE' = 'TEXT', attachmentUrl?: string) {
    if (!body.trim() && !attachmentUrl) return;
    setSending(true);
    setError('');
    const res = await tripService.sendChatMessage(tripId, body.trim() || 'Photo', messageType, attachmentUrl);
    setSending(false);
    if (res.data) {
      setText('');
      await loadChat();
    } else {
      const msg = res.error?.message ?? 'Could not send message.';
      if (msg.includes('restricted')) setBlocked(true);
      else if (msg.includes('not open')) setClosedReason(CHAT_UNAVAILABLE_BEFORE_LABEL);
      else if (msg.includes('moderation')) setError('Message could not be sent due to FIZZA safety rules.');
      else setError(msg);
    }
  }

  async function handleImageUpload(file: File) {
    setUploading(true);
    setError('');
    const res = await tripService.uploadChatAttachment(tripId, file);
    setUploading(false);
    if (res.data?.attachmentUrl) {
      await sendMessage('Photo', 'IMAGE', res.data.attachmentUrl);
    } else {
      setError(res.error?.message ?? 'Could not upload image.');
    }
  }

  if (!open) return null;

  const canSend = windowOpen && !blocked && !sending && !uploading;

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Trip chat">
      <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} aria-label="Close chat" />
      <div className="relative ml-auto flex h-full w-full max-w-lg flex-col bg-white shadow-2xl max-md:max-w-none md:rounded-l-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-4 shrink-0 safe-area-top">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900">Trip chat</h2>
            <p className="text-sm text-gray-600 mt-0.5">{tripSummary.riderName} · {fmtDriverTime(tripSummary.scheduledPickupTime)}</p>
            <p className="text-xs text-gray-400 truncate" title={tripSummary.pickup}>
              {truncateRouteLabel(tripSummary.pickup, 36)} → {truncateRouteLabel(tripSummary.dropoff, 36)}
            </p>
            {tripSummary.parentName && userRole === 'DRIVER' && (
              <p className="text-xs text-gray-500 mt-1">Parent: {tripSummary.parentName}</p>
            )}
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2.5 text-gray-400 hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {blocked && (
          <div className="mx-4 mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
            {CHAT_BLOCKED_LABEL}
          </div>
        )}

        {!blocked && !windowOpen && closedReason && (
          <div className="mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            {closedReason}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-8">Loading messages…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No messages yet. Say hello when chat is open.</p>
          ) : (
            messages.map((m) => {
              const mine = m.senderRole === userRole;
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                    {!mine && <p className="text-[10px] font-semibold uppercase opacity-70 mb-0.5">{m.senderRole === 'DRIVER' ? 'Driver' : 'Parent'}</p>}
                    {m.messageType === 'IMAGE' && m.attachmentUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.attachmentUrl} alt="Attachment" className="rounded-lg max-h-40 mb-1" />
                    ) : null}
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p className={`text-[10px] mt-1 ${mine ? 'text-emerald-100' : 'text-gray-400'}`}>
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {windowOpen && !blocked && (
          <div className="border-t border-gray-100 px-4 py-2 shrink-0">
            <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
              {quickReplies.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={!canSend}
                  onClick={() => sendMessage(q, 'QUICK_REPLY')}
                  className="shrink-0 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <p className="px-4 text-xs text-red-600 pb-1">{error}</p>}

        <div className="border-t border-gray-100 px-4 py-3 shrink-0 bg-gray-50/80 safe-area-bottom">
          <div className="flex gap-2 items-end">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImageUpload(f);
              e.target.value = '';
            }} />
            <button
              type="button"
              disabled={!canSend}
              onClick={() => fileRef.current?.click()}
              className="rounded-xl border border-gray-200 p-2.5 text-gray-500 hover:bg-white disabled:opacity-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Attach image"
            >
              <ImagePlus className="h-5 w-5" />
            </button>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={!canSend}
              placeholder={canSend ? 'Type a message…' : closedReason ?? CHAT_UNAVAILABLE_BEFORE_LABEL}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm min-h-[44px] max-h-24 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:bg-gray-100"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (canSend && text.trim()) sendMessage(text);
                }
              }}
            />
            <Button variant="primary" size="sm" disabled={!canSend || !text.trim()} loading={sending} onClick={() => sendMessage(text)} className="min-h-[44px] min-w-[44px] px-3">
              <Send className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
