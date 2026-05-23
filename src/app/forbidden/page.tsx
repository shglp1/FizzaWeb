export default function ForbiddenPage() {
  return (
    <div className="min-h-screen bg-fizza-bg flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-red-50 text-5xl mb-6">
          🚫
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
        <p className="text-gray-500 mb-8">
          You don&apos;t have permission to view this page. If you believe this is a mistake,
          please contact support or try logging in with a different account.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-fizza-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 transition-colors"
          >
            Go to Dashboard
          </a>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
