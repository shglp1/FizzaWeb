import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Bell, CalendarDays, Car, CheckCircle, CreditCard, MapPin, Radio, Shield, Users } from 'lucide-react';
import { Logo } from '@/components/layout/Logo';

// ─── Feature card ─────────────────────────────────────────────────────────────

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="card p-6 flex flex-col gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-fizza-secondary">
        <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
      </div>
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="min-h-screen bg-fizza-bg flex flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="mx-auto max-w-6xl px-4 md:px-8 flex items-center justify-between h-16">
          <Logo theme="light" />
          <nav className="flex items-center gap-2">
            <Link href="/login" className="btn-ghost text-sm">
              Sign In
            </Link>
            <Link href="/register" className="btn-primary text-sm">
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 md:px-8 pt-16 pb-20 grid md:grid-cols-2 gap-12 items-center">
          <div className="flex flex-col gap-6">
            <div className="badge-success w-fit text-xs font-semibold px-3 py-1 rounded-full inline-flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" aria-hidden />
              Safety-First Transportation
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 leading-tight">
              Safe Rides.{' '}
              <span className="text-fizza-secondary">Every Schedule.</span>
            </h1>
            <p className="text-lg text-gray-500 leading-relaxed max-w-md">
              Scheduled family transportation with real-time tracking, verified drivers, and
              complete peace of mind — built for families who care.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/register" className="btn-primary btn-lg">
                Start Free Today
              </Link>
              <Link href="/subscriptions" className="btn-outline btn-lg">
                View Plans
              </Link>
            </div>

            {/* Trust signals */}
            <div className="flex flex-wrap gap-6 pt-2 text-sm text-gray-500">
              {['GPS Tracked', 'Vetted Drivers', 'Instant Alerts', 'Cancel Anytime'].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-fizza-secondary" />
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Hero visual */}
          <div className="relative rounded-3xl bg-gradient-to-br from-fizza-primary via-emerald-700 to-fizza-secondary p-8 text-white overflow-hidden h-80 md:h-auto">
            {/* Background decoration */}
            <div className="absolute -top-10 -right-10 h-48 w-48 rounded-full bg-white/5" />
            <div className="absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-white/5" />

            {/* Mock stat cards */}
            <div className="relative space-y-3">
              <div className="rounded-2xl bg-white/15 backdrop-blur-sm p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-fizza-soft/30 flex items-center justify-center">
                  <Car className="h-5 w-5 text-white" strokeWidth={1.75} aria-hidden />
                </div>
                <div>
                  <p className="text-xs text-white/70">Next pickup</p>
                  <p className="font-bold">In 8 minutes · Ahmad</p>
                </div>
                <span className="ml-auto badge-success text-xs">Live</span>
              </div>

              <div className="rounded-2xl bg-white/15 backdrop-blur-sm p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-fizza-soft/30 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-white" strokeWidth={1.75} aria-hidden />
                </div>
                <div>
                  <p className="text-xs text-white/70">Status</p>
                  <p className="font-bold">Noura dropped safely</p>
                </div>
                <span className="ml-auto text-fizza-soft text-sm font-bold">2m ago</span>
              </div>

              <div className="rounded-2xl bg-white/15 backdrop-blur-sm p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-fizza-soft/30 flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-white" strokeWidth={1.75} aria-hidden />
                </div>
                <div>
                  <p className="text-xs text-white/70">Tracking</p>
                  <p className="font-bold">Al-Nuzha District</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="bg-white py-16 border-y border-gray-100">
          <div className="mx-auto max-w-6xl px-4 md:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900">Everything your family needs</h2>
              <p className="mt-2 text-gray-500">A complete transportation platform built for safety and reliability.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <FeatureCard
                icon={CalendarDays}
                title="Scheduled Trips"
                description="Set recurring routes and let Fizza handle pick-ups and drop-offs — no daily booking needed."
              />
              <FeatureCard
                icon={Radio}
                title="Real-Time Tracking"
                description="See exactly where your riders are at every moment with live GPS updates."
              />
              <FeatureCard
                icon={Shield}
                title="Verified Drivers"
                description="Every driver is background-checked, trained, and monitored for your family's safety."
              />
              <FeatureCard
                icon={Bell}
                title="Instant Notifications"
                description="Get alerts the moment a rider is picked up, dropped off, or if anything changes."
              />
              <FeatureCard
                icon={CreditCard}
                title="Flexible Plans"
                description="Choose from monthly or annual subscriptions — scale up, down, or pause any time."
              />
              <FeatureCard
                icon={Users}
                title="Multiple Riders"
                description="Manage all your family members from one account with individual profiles per rider."
              />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-4 md:px-8 py-20 text-center">
          <h2 className="text-3xl font-bold text-gray-900">Ready to ride safely?</h2>
          <p className="mt-3 text-gray-500 max-w-md mx-auto">
            Join thousands of families who trust Fizza for their daily transportation.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register" className="btn-primary btn-lg">
              Create Free Account
            </Link>
            <Link href="/login" className="btn-outline btn-lg">
              Sign In
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white py-8">
        <div className="mx-auto max-w-6xl px-4 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <Logo theme="light" />
          <p>© {new Date().getFullYear()} Fizza. All rights reserved.</p>
          <nav className="flex gap-4">
            <Link href="/subscriptions" className="hover:text-gray-600 transition-colors">Plans</Link>
            <Link href="/login" className="hover:text-gray-600 transition-colors">Login</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
