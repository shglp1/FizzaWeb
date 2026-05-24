'use client';

import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Briefcase,
  Bus,
  Car,
  ClipboardList,
  Clock,
  FileText,
  IdCard,
  MapPin,
  Shield,
  Sparkles,
  Truck,
  Users,
} from 'lucide-react';
import { Logo } from '@/components/layout/Logo';

// ─── FAQ data ─────────────────────────────────────────────────────────────────

const FAQ = [
  {
    q: 'How long does the review process take?',
    a: 'Most applications are reviewed within 1–3 business days. You will receive a notification once a decision is made.',
  },
  {
    q: 'Can I edit my application after submitting?',
    a: 'If the admin requests changes, you can edit and resubmit your application. You cannot edit a pending or approved application.',
  },
  {
    q: 'What happens after I am approved?',
    a: 'Once approved, your account is upgraded to Driver status. You will gain access to the Driver Dashboard and begin receiving assigned trips.',
  },
  {
    q: 'Can I drive part-time?',
    a: 'Yes. You set your own availability. Trips are assigned based on your schedule and service area.',
  },
  {
    q: 'Do I need a specific type of vehicle?',
    a: 'We accept Economy, Comfort, Family SUV, Van, School Bus, and Premium vehicles. Your vehicle must be clean, safe, and road-worthy.',
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-4 text-left gap-4"
      >
        <span className="text-sm font-semibold text-gray-900">{q}</span>
        <span className={`shrink-0 w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center transition-transform ${open ? 'rotate-45' : ''}`}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </span>
      </button>
      {open && <p className="text-sm text-gray-600 pb-4 leading-relaxed">{a}</p>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DriveLandingPage() {
  return (
    <div className="min-h-screen bg-white">

      {/* ── Navbar ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <a href="/drive" aria-label="Fizza driver portal">
            <Logo theme="light" />
          </a>
          <nav className="flex items-center gap-3">
            <a
              href="/driver/login"
              className="text-sm font-semibold text-gray-700 hover:text-fizza-primary transition-colors px-3 py-2"
            >
              Driver Sign In
            </a>
            <a
              href="/driver/register"
              className="inline-flex items-center gap-1.5 rounded-xl bg-fizza-primary px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 transition-colors"
            >
              Apply Now
            </a>
          </nav>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-fizza-primary via-emerald-700 to-emerald-900 text-white">
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/3" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-3 py-1 text-xs font-semibold mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-fizza-soft animate-pulse" />
              Now recruiting drivers across Saudi Arabia
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-4">
              Drive with Fizza
            </h1>
            <p className="text-xl text-emerald-100 mb-2 font-medium">
              Join the trusted family transportation network
            </p>
            <p className="text-emerald-200 mb-10 leading-relaxed">
              Earn on your schedule while providing safe, professional transportation
              for families. Clear trip assignments, GPS-assisted operations, and a
              platform built around safety and reliability.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="/driver/register"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-fizza-soft text-fizza-primary px-6 py-3.5 text-sm font-bold hover:brightness-105 transition-all shadow-lg shadow-black/10"
              >
                Apply as a Driver
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </a>
              <a
                href="/driver/login"
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-white/30 bg-white/10 px-6 py-3.5 text-sm font-semibold hover:bg-white/20 transition-all"
              >
                Driver Sign In
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats strip ─────────────────────────────────────────────────────── */}
      <section className="bg-fizza-primary/5 border-y border-emerald-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-3 sm:grid-cols-3 gap-4 text-center">
          {[
            { stat: 'Flexible', label: 'Work your own schedule' },
            { stat: 'Safe',     label: 'Safety-first platform' },
            { stat: 'Reliable', label: 'Steady trip assignments' },
          ].map((item) => (
            <div key={item.stat}>
              <p className="text-lg sm:text-xl font-bold text-fizza-primary">{item.stat}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Benefits ────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Why drive with Fizza?</h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            A professional platform designed to support drivers with the tools,
            assignments, and safety they need.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {([
            { Icon: Clock, title: 'Flexible hours', desc: 'Set your own availability. Work mornings, afternoons, or weekends — your schedule, your choice.' },
            { Icon: Users, title: 'Trusted families', desc: 'You transport verified family members — children and students — from a platform built on trust.' },
            { Icon: ClipboardList, title: 'Clear assignments', desc: 'Trips are structured and pre-scheduled. Know your route, pickup, and dropoff in advance.' },
            { Icon: MapPin, title: 'GPS-assisted ops', desc: 'GPS tracking built in. Share your location during trips for family peace of mind.' },
            { Icon: Shield, title: 'Safety-first', desc: 'Safety reporting, incident escalation, and admin support — you are never alone on the road.' },
            { Icon: Briefcase, title: 'Professional support', desc: 'Dedicated admin team to review your application, handle issues, and support your operations.' },
          ] as { Icon: LucideIcon; title: string; desc: string }[]).map((b) => (
            <div key={b.title} className="rounded-2xl border border-gray-100 bg-white p-6 hover:shadow-md transition-shadow">
              <b.Icon className="h-8 w-8 text-fizza-secondary mb-3" strokeWidth={1.75} aria-hidden />
              <h3 className="font-semibold text-gray-900 mb-1.5">{b.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────────── */}
      <section className="bg-gray-50 py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">How it works</h2>
            <p className="text-gray-500">From application to your first trip in a few simple steps.</p>
          </div>

          <div className="space-y-5">
            {[
              {
                step: '1',
                title: 'Create your driver account',
                desc: 'Register with your name, email, and phone. No customer account needed — this is a dedicated driver flow.',
              },
              {
                step: '2',
                title: 'Submit your application',
                desc: 'Fill in your vehicle details, driving license number, service area, and any supporting document links.',
              },
              {
                step: '3',
                title: 'Admin review',
                desc: 'Our team reviews your application within 1–3 business days. We may request additional information.',
              },
              {
                step: '4',
                title: 'Get approved',
                desc: 'Once approved, your account is upgraded to Driver status. You receive a notification and gain full access.',
              },
              {
                step: '5',
                title: 'Start receiving trips',
                desc: 'Log into your Driver Dashboard to see assigned trips, track your schedule, and manage your GPS.',
              },
            ].map((item, i) => (
              <div key={item.step} className="flex gap-4">
                <div className="shrink-0 flex flex-col items-center">
                  <div className="w-9 h-9 rounded-full bg-fizza-primary text-white flex items-center justify-center text-sm font-bold">
                    {item.step}
                  </div>
                  {i < 4 && <div className="w-0.5 h-6 bg-emerald-200 mt-1" />}
                </div>
                <div className="pb-2">
                  <h3 className="font-semibold text-gray-900 mb-0.5">{item.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Requirements ────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Requirements</h2>
            <p className="text-gray-500 mb-8">
              To join the Fizza driver network, you must meet the following requirements.
            </p>
            <ul className="space-y-3">
              {([
                { Icon: IdCard, text: 'Valid national ID or iqama' },
                { Icon: ClipboardList, text: 'Valid Saudi driving license' },
                { Icon: Car, text: 'Vehicle details (brand, model, year, plate)' },
                { Icon: FileText, text: 'Vehicle registration document' },
                { Icon: Sparkles, text: 'Clean, safe, and road-worthy vehicle' },
                { Icon: Shield, text: 'Commitment to safety and punctuality' },
              ] as { Icon: LucideIcon; text: string }[]).map((r) => (
                <li key={r.text} className="flex items-start gap-3">
                  <r.Icon className="h-5 w-5 text-fizza-secondary shrink-0 mt-0.5" strokeWidth={1.75} aria-hidden />
                  <span className="text-gray-700 text-sm">{r.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl bg-gradient-to-br from-fizza-primary to-emerald-700 p-8 text-white">
            <Car className="h-10 w-10 text-white mb-4" strokeWidth={1.75} aria-hidden />
            <h3 className="text-xl font-bold mb-2">Accepted vehicle types</h3>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {([
                { Icon: Car, label: 'Economy' },
                { Icon: Car, label: 'Comfort' },
                { Icon: Truck, label: 'Family SUV' },
                { Icon: Bus, label: 'Van' },
                { Icon: Bus, label: 'School Bus' },
                { Icon: Sparkles, label: 'Premium' },
              ] as { Icon: LucideIcon; label: string }[]).map((v) => (
                <div key={v.label} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
                  <v.Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  <span className="text-sm font-medium">{v.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────────── */}
      <section className="bg-gray-50 py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Frequently asked questions</h2>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 px-6 divide-y divide-gray-100">
            {FAQ.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ──────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-r from-fizza-primary to-emerald-700 text-white py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Ready to join?</h2>
          <p className="text-emerald-100 mb-8 text-lg">
            Create your driver account and submit your application today.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="/driver/register"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-fizza-soft text-fizza-primary px-8 py-3.5 text-sm font-bold hover:brightness-105 transition-all shadow-lg shadow-black/20"
            >
              Apply as a Driver
            </a>
            <a
              href="/driver/login"
              className="inline-flex items-center justify-center rounded-xl border-2 border-white/40 bg-white/10 px-8 py-3.5 text-sm font-semibold hover:bg-white/20 transition-all"
            >
              Already applied? Sign in
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
          <span>© {new Date().getFullYear()} Fizza. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <a href="/login" className="hover:text-gray-600 transition-colors">For Families</a>
            <a href="/login" className="hover:text-gray-600 transition-colors">Family Sign In</a>
            <a href="/drive" className="hover:text-gray-600 transition-colors">For Drivers</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
