/** Shown while a page's code is downloaded (pages are split into their own chunks). */
export default function PageLoading() {
  return (
    <div className="flex h-full min-h-[240px] w-full items-center justify-center" role="status" aria-live="polite">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
      <span className="sr-only">Loading page</span>
    </div>
  );
}
